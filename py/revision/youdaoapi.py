#20240712
#Inspiration：https://www.kimi.com/share/d1n8ass432e27oevtjhg
from fastapi import FastAPI, Body
from pydantic import BaseModel, Field
import base64
import time
import json
from Crypto.Cipher import AES
import hashlib
import requests

app = FastAPI()

# 更新后的请求参数模型，用于 JSON 请求体
class TranslationParams(BaseModel):
    source_lang: str = Field(..., example='en')  # 源语言代码
    target_lang: str = Field(..., example='es')  # 目标语言代码
    text_list: list = Field(..., example=['Hello', 'World'])  # 翻译文本数组

ti = str(int(time.time() * 1000))

# sign值加密
def sign():
    str_md5 = f'client=fanyideskweb&mysticTime={str(ti)}&product=webfanyi&key=SRz6r3IGA6lj9i5zW0OYqgVZOtLDQe3e'
    sign = hashlib.md5(str_md5.encode("utf-8")).hexdigest()
    return sign

# 返回值解密
def result(text_AES):
    # 偏移量
    decodeiv = "ydsecret://query/iv/C@lZe2YzHtZ2CYgaXKSVfsb7Y4QWHjITPPZ0nQp87fBeJ!Iv6v^6fvi2WN@bYpJ4"
    # 秘钥
    decodekey = "ydsecret://query/key/B*RGygVywfNBwpmBaZg*WT7SIOUP2T0C9WHMZN39j^DAdaZhAnxvGcCY6VYFwnHl"
    # 先把密匙和偏移量进行md5加密 digest()是返回二进制的值
    key = hashlib.md5(decodekey.encode(encoding='utf-8')).digest()
    iv = hashlib.md5(decodeiv.encode(encoding='utf-8')).digest()
    # AES解密 CBC模式解密
    aes_en = AES.new(key, AES.MODE_CBC, iv)
    # 将已经加密的数据放进该方法
    data_new = base64.urlsafe_b64decode(text_AES)
    # 参数准备完毕后，进行解密
    result = aes_en.decrypt(data_new).decode('utf-8')
    return result

def lang(lang_code):
    if lang_code == 'zh-CN':
        return 'zh-CHS'
    else:
        return lang_code

# 将原有的 input 函数替换为 FastAPI 的路径操作
@app.post("/translate")
async def translate(params: TranslationParams):
    # 输入Cookie
    #cookie = '0'
    source_lang = params.source_lang
    target_lang = params.target_lang
    text_list = params.text_list
    
    # 判断是否输入了Cookie
    #if cookie == '0':
    cookies = 'OUTFOX_SEARCH_USER_ID=-2034389685@10.110.96.157; OUTFOX_SEARCH_USER_ID_NCOO=1994625046.2245197'
    useTerm = 'false'
    #else:
    #    if cookie == '1':
    #        cookies = 'OUTFOX_SEARCH_USER_ID_NCOO=293507045.12076473; OUTFOX_SEARCH_USER_ID=-400068484@223.152.121.87; __yadk_uid=79aGkEFpTzJrACqgdByBYiATchs9xeBc; DICT_DOCTRANS_SESSION_ID=MGNlODdkZmQtNzU5Ny00OGQ3LWExYWQtMDdmNjIyNGFiM2Vm; DICT_SESS=v2|siNE4DWheqB0fzGP4pL0Quk4PL0H6y0lEOLpz0fwS0PLnMQS6LQS0zW0MpFnH6y06LPMl50MJu0zfRHO50fkMRJFhMe4RH6BR; DICT_LOGIN=1||1718433177017; DICT_UT=uqqUID_8D6649456355815372D22E9500BB5561; UM_distinctid=1901a99c4a92f0-01e5cbbfe41f69-4c657b58-1fa400-1901a99c4aa217b'
    #        useTerm = 'true'
    #    else:
    #        useTerm = params.useTerm
    #        if useTerm == '0':
    #            useTerm = 'false'
    #        else:
    #            useTerm = 'true'
    
    headers = {
        "Origin": "https://fanyi.youdao.com",
        "Referer": "https://fanyi.youdao.com/",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36 Edg/125.0.0.0",
        'Host':'dict.youdao.com',
        'cookie':cookies
    }
    
    get_from = lang(source_lang)
    if get_from == 'auto':
        to = ''
    else:
        to = lang(target_lang)
    
    translations = []
    
    for word in text_list:
        data = {
            "i": word,
            "from": str('auto'),
            "to": str(''),
            #"domain": "0",
            "useTerm": useTerm,
            "dictResult": "true",
            "keyid": "webfanyi",
            "sign": sign(),
            "client": "fanyideskweb",
            "product": "webfanyi",
            "appVersion": "1.0.0",
            "vendor": "web",
            "pointParam": "client,mysticTime,product",
            "mysticTime": str(ti),
            "keyfrom": "fanyi.web",
            "mid": "1",
            "screen": "1",
            "model": "1",
            "network": "wifi",
            "abtest": "0",
            "yduuid": "abcdefg"
        }
        url = "https://dict.youdao.com/webtranslate"
        response = requests.post(url, headers=headers, data=data)
        result1 = result(response.text)
        while not result1.endswith('}'):
            result1 = result1[:-1]
        result2 = json.loads(result1)
        if (response.status_code == 200 and 
            "translateResult" in result2 and 
            result2["translateResult"] and 
            len(result2["translateResult"]) > 0 and 
            len(result2["translateResult"][0]) > 0 and 
            "tgt" in result2["translateResult"][0][0]):
            translations.append({
                "detected_source_lang": str(get_from),
                "text": result2["translateResult"][0][0]["tgt"]
            })
        else:
            # 处理错误情况，这里只是记录失败，具体错误处理根据需要实现
            translations.append({
                "detected_source_lang": "unknown",
                "text": f""
            })
    
    return {"translations": translations}

# 运行 Uvicorn 服务器
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=3000)
