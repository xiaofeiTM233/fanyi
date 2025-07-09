import crypto from 'crypto';
import fetch from 'node-fetch';

// 全局时间戳（服务启动时生成一次）
let timestamp = Math.floor(Date.now() * 1000).toString();

// 签名生成函数
const generateSign = () => {
  const rawStr = `client=fanyideskweb&mysticTime=${timestamp}&product=webfanyi&key=SRz6r3IGA6lj9i5zW0OYqgVZOtLDQe3e`;
  return crypto.createHash('md5').update(rawStr).digest('hex');
};

// AES解密函数
const decryptResult = (encryptedText) => {
  const keyRaw = "ydsecret://query/key/B*RGygVywfNBwpmBaZg*WT7SIOUP2T0C9WHMZN39j^DAdaZhAnxvGcCY6VYFwnHl";
  const ivRaw = "ydsecret://query/iv/C@lZe2YzHtZ2CYgaXKSVfsb7Y4QWHjITPPZ0nQp87fBeJ!Iv6v^6fvi2WN@bYpJ4";

  const key = crypto.createHash('md5').update(keyRaw).digest();
  const iv = crypto.createHash('md5').update(ivRaw).digest();

  const decipher = crypto.createDecipheriv('aes-128-cbc', key, iv);
  let decrypted = decipher.update(encryptedText, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
};

// 语言代码转换
const convertLang = (lang) => lang === 'zh-CN' ? 'zh-CHS' : lang;

// 重试机制
const withRetry = async (fn, retries = 3, delay = 500) => {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(res => setTimeout(res, delay));
    }
  }
};

// Vercel Serverless Function入口
export default async function handler(req, res) {
  // 仅允许POST请求
  if (req.method !== 'POST') {
    res.status(405).json({ error: '仅支持POST请求' });
    return;
  }

  try {
    // Vercel已自动解析req.body，无需手动解析
    const body = req.body || {};

    // 参数校验（严格模式）
    if (!body.source_lang || typeof body.source_lang !== 'string') {
      res.status(400).json({ error: '缺少source_lang参数或格式错误' });
      return;
    }
    
    if (!body.target_lang || typeof body.target_lang !== 'string') {
      res.status(400).json({ error: '缺少target_lang参数或格式错误' });
      return;
    }
    
    if (!Array.isArray(body.text_list) || body.text_list.length === 0) {
      res.status(400).json({ error: 'text_list必须是包含至少一个字符串的数组' });
      return;
    }
    
    for (let i = 0; i < body.text_list.length; i++) {
      if (typeof body.text_list[i] !== 'string') {
        res.status(400).json({ error: `text_list[${i}] 必须是字符串类型` });
        return;
      }
    }

    // 固定Cookies（从环境变量读取）
    const cookies = process.env.YOUDAO_COOKIES || 
      'OUTFOX_SEARCH_USER_ID=-2034389685@10.110.96.157; OUTFOX_SEARCH_USER_ID_NCOO=1994625046.2245197';
    
    // 构造请求头
    const headers = {
      'Origin': 'https://fanyi.youdao.com',
      'Referer': 'https://fanyi.youdao.com/',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 Edg/125.0.0.0',
      'Host': 'dict.youdao.com',
      'Cookie': cookies,
      'Accept': 'application/json, text/plain, */*',
      'Content-Type': 'application/x-www-form-urlencoded'
    };

    // 翻译结果数组
    const translations = [];
    const sourceLang = convertLang(body.source_lang);
    const targetLang = convertLang(body.target_lang);

    // 遍历处理每个待翻译文本
    for (const text of body.text_list) {
      try {
        // 构造请求参数
        const requestData = {
          i: text,
          from: sourceLang,
          to: targetLang,
          dictResult: 'true',
          keyid: 'webfanyi',
          sign: generateSign(),
          client: 'fanyideskweb',
          product: 'webfanyi',
          appVersion: '1.0.0',
          vendor: 'web',
          pointParam: 'client,mysticTime,product',
          mysticTime: timestamp,
          keyfrom: 'fanyi.web'
        };

        // 使用带有重试机制的请求
        const response = await withRetry(async () => {
          const response = await fetch('https://dict.youdao.com/webtranslate', {
            method: 'POST',
            headers,
            body: new URLSearchParams(requestData).toString()
          });

          // 检查HTTP状态码
          if (!response.ok) {
            const error = new Error(`有道API请求失败: ${response.status} ${response.statusText}`);
            error.status = response.status;
            throw error;
          }
          
          return response;
        }, 3, 500); // 重试3次，每次间隔500ms

        // 获取响应内容
        const rawResponse = await response.text();
        
        // 修复可能的JSON格式问题
        let cleanResponse = await decryptResult(rawResponse);
        const lastBraceIndex = cleanResponse.lastIndexOf('}');
        if (lastBraceIndex !== -1) {
          cleanResponse = cleanResponse.substring(0, lastBraceIndex + 1);
        } else {
			console.log(rawResponse);
          throw new Error('无法解析有道API响应');
        }

        // 解析JSON数据
        const result = JSON.parse(cleanResponse);

        // 提取有效翻译结果
        if (result.translateResult?.[0]?.[0]?.tgt) {
          translations.push({
            detected_source_lang: sourceLang,
            text: result.translateResult[0][0].tgt
          });
        } else {
          console.warn('有道API返回无效翻译结果:', result);
          translations.push({
            detected_source_lang: sourceLang,
            text: text, // 返回原文作为默认值
            warning: '有道API返回无效结果'
          });
        }
      } catch (error) {
        console.error(`翻译文本"${text}"时出错:`, error);
        
        if (error.status === 500) {
          translations.push({
            detected_source_lang: sourceLang,
            text: text, // 返回原文作为默认值
            error: '有道翻译服务暂时不可用，请稍后再试'
          });
        } else {
          translations.push({
            detected_source_lang: 'error',
            text: '',
            error: error.message
          });
        }
      }
    }

    // 返回最终结果
    res.status(200).json({ translations });

  } catch (error) {
    console.error('处理请求时发生错误:', error);
    res.status(500).json({ 
      error: '服务器内部错误',
      message: error.message
    });
  }
}
