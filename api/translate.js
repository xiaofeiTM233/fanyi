import crypto from 'crypto';
import fetch from 'node-fetch';

// 预计算AES密钥（只需计算一次）
const KEY_RAW = "ydsecret://query/key/B*RGygVywfNBwpmBaZg*WT7SIOUP2T0C9WHMZN39j^DAdaZhAnxvGcCY6VYFwnHl";
const IV_RAW = "ydsecret://query/iv/C@lZe2YzHtZ2CYgaXKSVfsb7Y4QWHjITPPZ0nQp87fBeJ!Iv6v^6fvi2WN@bYpJ4";
const AES_KEY = crypto.createHash('md5').update(KEY_RAW).digest();
const AES_IV = crypto.createHash('md5').update(IV_RAW).digest();

// 签名生成函数（接收动态时间戳）
const generateSign = (timestamp) => {
  const rawStr = `client=fanyideskweb&mysticTime=${timestamp}&product=webfanyi&key=SRz6r3IGA6lj9i5zW0OYqgVZOtLDQe3e`;
  return crypto.createHash('md5').update(rawStr).digest('hex');
};

// 增强型AES解密函数（带错误处理）
const decryptResult = (encryptedText) => {
  try {
    const decipher = crypto.createDecipheriv('aes-128-cbc', AES_KEY, AES_IV);
    let decrypted = decipher.update(encryptedText, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error('解密失败:', error.message);
    throw new Error('解密过程中发生错误');
  }
};

// 语言代码转换器
const convertLang = (lang) => lang === 'zh-CN' ? 'zh-CHS' : lang;

// 增强型重试机制（带指数退避）
const withRetry = async (fn, retries = 3, baseDelay = 300) => {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === retries) throw error;
      
      // 指数退避重试
      const delay = baseDelay * Math.pow(2, attempt);
      console.warn(`请求失败，${delay}ms后重试 (${attempt}/${retries})`);
      await new Promise(res => setTimeout(res, delay));
    }
  }
};

// 统一错误响应处理
const sendErrorResponse = (res, statusCode, message) => {
  console.error(`[${statusCode}] ${message}`);
  return res.status(statusCode).json({ error: message });
};

// Vercel Serverless Function入口
export default async function handler(req, res) {
  // 仅允许POST请求
  if (req.method !== 'POST') {
    return sendErrorResponse(res, 405, '仅支持POST请求');
  }

  try {
    // 获取请求体
    const body = req.body || {};

    // 参数验证增强
    if (!body.source_lang || typeof body.source_lang !== 'string') {
      return sendErrorResponse(res, 400, '缺少或无效的source_lang参数');
    }
    
    if (!body.target_lang || typeof body.target_lang !== 'string') {
      return sendErrorResponse(res, 400, '缺少或无效的target_lang参数');
    }
    
    if (!Array.isArray(body.text_list) || body.text_list.length === 0) {
      return sendErrorResponse(res, 400, 'text_list必须是非空字符串数组');
    }
    
    if (body.text_list.some(text => typeof text !== 'string')) {
      return sendErrorResponse(res, 400, 'text_list包含非字符串元素');
    }
    
    // 读取环境变量（无默认值）
    const cookies = process.env.COOKIES;
    if (!cookies) {
      return sendErrorResponse(res, 500, '缺少环境变量COOKIES');
    }

    // 准备请求配置
    const requestConfig = {
      headers: {
        'Origin': 'https://fanyi.youdao.com',
        'Referer': 'https://fanyi.youdao.com/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        'Cookie': cookies,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    };

    // 准备翻译任务
    const sourceLang = convertLang(body.source_lang);
    const targetLang = convertLang(body.target_lang);
    const translations = [];
    
    // 处理每个翻译请求
    for (const [index, text] of body.text_list.entries()) {
      try {
        const translation = await withRetry(async () => {
          // 动态生成时间戳和签名
          const timestamp = Date.now().toString();
          const sign = generateSign(timestamp);
          
          // 构造请求参数
          const requestData = {
            i: text,
            from: sourceLang,
            to: targetLang,
            dictResult: 'true',
            keyid: 'webfanyi',
            sign,
            client: 'fanyideskweb',
            product: 'webfanyi',
            appVersion: '1.0.0',
            vendor: 'web',
            pointParam: 'client,mysticTime,product',
            mysticTime: timestamp,
            keyfrom: 'fanyi.web'
          };
          
          // 发送翻译请求
          const response = await fetch('https://dict.youdao.com/webtranslate', {
            method: 'POST',
            ...requestConfig,
            body: new URLSearchParams(requestData).toString()
          });
          
          // 处理HTTP错误
          if (!response.ok) {
            throw new Error(`API响应错误: ${response.status} ${response.statusText}`);
          }
          
          // 获取并处理响应
          const encrypted = await response.text();
          let decrypted = decryptResult(encrypted);
          
          // 清理JSON格式
          const lastBraceIndex = decrypted.lastIndexOf('}');
          if (lastBraceIndex === -1) throw new Error('无效的API响应格式');
          decrypted = decrypted.substring(0, lastBraceIndex + 1);
          
          // 解析响应
          const result = JSON.parse(decrypted);
          
          // 验证并返回翻译结果
          const translatedText = result.translateResult?.[0]?.[0]?.tgt;
          if (!translatedText) throw new Error('无效的翻译结果结构');
          
          return {
            detected_source_lang: sourceLang,
            text: translatedText
          };
        });
        
        translations.push(translation);
      } catch (error) {
        console.error(`文本[${index}]翻译失败:`, error.message);
        translations.push({
          original_text: text,
          detected_source_lang: 'error',
          text: '',
          error: error.message
        });
      }
    }
    
    // 返回成功响应
    return res.status(200).json({ translations });
    
  } catch (error) {
    // 全局错误处理
    console.error('服务器错误:', error);
    return sendErrorResponse(res, 500, `内部服务器错误: ${error.message}`);
  }
}
