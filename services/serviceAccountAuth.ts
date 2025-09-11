import * as jsrsasign from 'jsrsasign';

// Service Account 정보 (실제 환경에서는 환경변수로 관리)
const SERVICE_ACCOUNT_EMAIL = 'vidhunt-drive-service@channelfinder-471006.iam.gserviceaccount.com';
const PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDRwpIUuXqrPhgI
aiN/2MAMwahItCunG79B2N1ETVo0hhoR7jsgUMeG/Ab1BVVKGhGRCNvgXF3DF/eW
BUaaZy6wRpR0+bq7KettUDCB/whHlinmdsO1BVLU/SQIK7viN+vPA6fmmlJPYYMz
lpDP79OLM1FrRFmUfIl2q4uApv4QHgLf29iAuxDy2+KXmtFBHPBYZ2gSSHup7/Qp
Cnr/fpqYxvGEEGKdIY8UhpFIAtutQHZhdaIh/+9l58sEu69dfD+Yk+JdlncaCUxr
6F5GTFsfvpX7jTr3FQIm5n+0cX9i/35VwboHtWdPZwnu0MPV+ENXNMTD+jqlwNDv
h0HJSxhtAgMBAAECggEAEPiIsHaP5ITslYReL5Ijek9nbyJsmbjr+3GGor0OEaEm
libLz9cunXmMkoxblILmwvDli+ciiuNIhnG81Ec0MXzfDAEcc4IhExdheqhd93TA
b8NSHYuQYmfCCjXc80uKSkBweCl/g/6kCoDMYevJwMG70k2VtdFxnxFNWHD/reFU
3JomiEvYmhf0XId6X2GqbJ22hzJPYyykbCZdgQkwo7ZB3WLgEdusgSHB0ZQeC70I
VcNSbEwVjBrkc63g1SS97Rt0tQdTgYpzbC5xRgjyzNUYqkN6RDzOh1v/2FoZOIS/
DNakeuwriSGSk0Q5TXYX7Qiie4i5oUqcUgtaR+AZXQKBgQDwvwg3iaeatjpQsB8a
kWu6n5CHSALpWesDqlkEuJZOk9uTCWNM+hTS2mWpXsud7obmLhd2kaVuEAl9Gb2r
ocM/OyOiIEsJwHwAp3wSMWDR9yYEsUd0dCclTyPHGqFKfN96he00uJe9yb05C8Cj
JPp1FbkrrapOCpGMu0SH1X6YEwKBgQDfDO85Au9N+UTVQ7kdf6axrU9Mkq0nUL34
ZAlVWKhCpDPDHP32+bnR5fqW7ZzHA4l9AsxKED2Tl6t0PcLxUjvjCKOlhl+x/sU0
6oXhS0oX4v8TUx37kcvJrvhd+isG7AyQAbPqelwp2oT1t33LN7k6fqzytDZHgHEP
OYn9Lh6dfwKBgQDvmK/M1isARqvy8dWC04erzHJCsOB07RCALWE62Zp9yZmV1JoH
WjyvPLxAvB9ZprKLEwQ29Oz3hO5smtmxnuR6YZktGYaUxgSjggxw7sO1M4uaz/SV
aaQr9X9eAJrVT0H65p8VAUHDmKvBwniN5Zd+P4hyd/wuf0YsEZQ6u7eqEQKBgQDL
ZG8MDMoMzz3ePughpxJpOMFz8NhmXnEsfIQqSDL+ud7dj6ViPewdI9pzIG9y5p3L
2e5RpyePW6Gj2OHXzoX/jBQ1zyeaFtjbXPQCMfZ5e6vfgk535UXwPlYK1CHCKSN3
eaYHLda276WIru7NjZ2hYnvwwTYx00TFflF/BjwynwKBgHjTM7T2i57f7+59+vmK
9oNDP5k2yKdub4dwgCzTNhbMU73eYX/8L02CDnddzEwmonSynNIS+jhomRXgHokE
q7AIYIG8oXQ5FiWOTTYYN3mptyRKr8fQ1nm1p4H4UmtYxid3AduLPt80wvx4JW5n
TbwGd8aQmjffB20Sfup6uxzI
-----END PRIVATE KEY-----`;

// 토큰 캐시
let cachedToken: string | null = null;
let tokenExpiryTime: number = 0;

/**
 * Service Account JWT 토큰 생성
 */
async function generateServiceAccountToken(): Promise<string> {
    console.log('🔑 Service Account JWT 토큰 생성 중...');
    
    const now = Math.floor(Date.now() / 1000);
    
    // JWT 헤더
    const header = {
        alg: 'RS256',
        typ: 'JWT'
    };
    
    // JWT 페이로드
    const payload = {
        iss: SERVICE_ACCOUNT_EMAIL,
        scope: 'https://www.googleapis.com/auth/drive', // 읽기/쓰기 권한
        aud: 'https://oauth2.googleapis.com/token',
        exp: now + 3600, // 1시간 후 만료
        iat: now
    };
    
    // JWT 생성
    const jwt = jsrsasign.KJUR.jws.JWS.sign(
        'RS256',
        JSON.stringify(header),
        JSON.stringify(payload),
        PRIVATE_KEY
    );
    
    console.log('🔓 JWT 토큰 생성 완료, Google OAuth2 토큰 요청 중...');
    
    // Google OAuth2 토큰 요청
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
            grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            assertion: jwt
        })
    });
    
    if (!tokenResponse.ok) {
        const errorData = await tokenResponse.text();
        throw new Error(`Service Account 토큰 생성 실패: ${tokenResponse.status} ${errorData}`);
    }
    
    const tokenData = await tokenResponse.json();
    console.log('✅ Service Account 액세스 토큰 발급 성공!');
    
    return tokenData.access_token;
}

/**
 * 캐시된 토큰 반환 또는 새 토큰 생성
 */
export async function getServiceAccountToken(): Promise<string> {
    const now = Date.now();
    
    // 캐시된 토큰이 있고 아직 유효하면 반환 (5분 여유)
    if (cachedToken && tokenExpiryTime > now + 5 * 60 * 1000) {
        console.log('♻️ 캐시된 Service Account 토큰 사용');
        return cachedToken;
    }
    
    // 새 토큰 생성
    console.log('🔄 새로운 Service Account 토큰 생성');
    cachedToken = await generateServiceAccountToken();
    tokenExpiryTime = now + 55 * 60 * 1000; // 55분 후 만료로 설정 (5분 여유)
    
    return cachedToken;
}

/**
 * 토큰 캐시 초기화
 */
export function clearTokenCache(): void {
    cachedToken = null;
    tokenExpiryTime = 0;
    console.log('🗑️ Service Account 토큰 캐시 초기화');
}