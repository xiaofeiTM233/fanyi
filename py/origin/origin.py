#Origin：https://blog.csdn.net/m0_73689941/article/details/133975299
import base64
import time
from Crypto.Cipher import AES
import requests
import hashlib

ti = str(int(time.time() * 1000))

# sign值加密
def sign():
    str_md5 = f'client=fanyideskweb&mysticTime={str(ti)}&product=webfanyi&key=fsdsogkndfokasodnaso'
    sign = hashlib.md5(str_md5.encode("utf-8")).hexdigest()
    return sign

# 返回值解密
def result(text_AES):
    #   偏移量
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


headers = {
    "Origin": "https://fanyi.youdao.com",
    "Referer": "https://fanyi.youdao.com/",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36 Edg/118.0.2088.61",
    'Host':'dict.youdao.com',
    'cookie':'OUTFOX_SEARCH_USER_ID=-2034389685@10.110.96.157; OUTFOX_SEARCH_USER_ID_NCOO=1994625046.2245197',
}

# 语言字典
dic_code = {0: '自动识别', 'code0': 'auto', 1: '阿拉伯文', 'code1': 'ar', 2: '冰岛文', 'code2': 'is', 3: '波兰文', 'code3': 'pl', 4: '德文', 'code4': 'de', 5: '俄文', 'code5': 'ru', 6: '法文', 'code6': 'fr', 7: '芬兰文', 'code7': 'fi', 8: '弗里西文', 'code8': 'fy', 9: '菲律宾文', 'code9': 'tl', 10: '韩文', 'code10': 'ko', 11: '荷兰文', 'code11': 'nl', 12: '蒙古文', 'code12': 'mn', 13: '缅甸文', 'code13': 'my', 14: '尼泊尔文', 'code14': 'ne', 15: '挪威文', 'code15': 'no', 16: '葡萄牙文', 'code16': 'pt', 17: '日文', 'code17': 'ja', 18: '瑞典文', 'code18': 'sv', 19: '世界文', 'code19': 'eo', 20: '土耳其文', 'code20': 'tr', 21: '乌克兰文', 'code21': 'uk', 22: '西班牙文', 'code22': 'es', 23: '希腊文', 'code23': 'el', 24: '夏威夷文', 'code24': 'haw', 25: '英文', 'code25': 'en', 26: '意大利文', 'code26': 'it', 27: '中文', 'code27': 'zh-CHS'}

# 获取输入语言
def get_from():
    print('选择数字，输入为什么语言：')
    # 判断是否报错
    try:
        from_data = int(input(f'{dic_code}：'))
        code_from = dic_code.get(f"code{from_data}")
        if code_from == None:
            get_from()
        print(f'输入为{dic_code.get(from_data)}')
        return code_from
    # 报错函数回调
    except:
        get_from()
# 翻译成语言
def get_to():
    print('选择数字，翻译成什么语言：')
    try:
        from_data = int(input(f'{dic_code}：'))
        code_from = dic_code.get(f"code{from_data}")
        if code_from == None:
            get_from()
        print(f'翻译为为{dic_code.get(from_data)}')
        return code_from
    except:
        get_from()

get_from1 = get_from()
# 判断是不是选择了自动选择
if get_from1 == 'auto':
    to = ''
else:
    to = get_to()

word = input('请输入语句')

data = {
    "i": word ,
    "from": str(get_from1),
    "to": str(to),
    "domain": "0",
    "dictResult": "true",
    "keyid": "webfanyi",
    "sign":sign(),
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

response = requests.post(url, headers=headers,data=data )
print(response)
print(response.text)

result1 = result(response.text)
print(result1)
