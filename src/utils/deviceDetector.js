/**
 * Device, Browser, IP, and Location Detection Utility
 */

function parseUserAgent(uaString = '') {
    if (!uaString || typeof uaString !== 'string') {
        return {
            browser: 'Browser Tidak Dikenal',
            device: 'Perangkat Tidak Dikenal',
            raw: ''
        };
    }

    const ua = uaString.trim();

    // 1. Detect Browser
    let browser = 'Browser Lain';
    if (/Edg\/([0-9.]+)/i.test(ua)) {
        const match = ua.match(/Edg\/([0-9.]+)/i);
        browser = `Microsoft Edge ${match ? match[1].split('.')[0] : ''}`.trim();
    } else if (/OPR\/([0-9.]+)/i.test(ua) || /Opera\/([0-9.]+)/i.test(ua)) {
        const match = ua.match(/(?:OPR|Opera)\/([0-9.]+)/i);
        browser = `Opera ${match ? match[1].split('.')[0] : ''}`.trim();
    } else if (/Chrome\/([0-9.]+)/i.test(ua) && !/Chromium/i.test(ua)) {
        const match = ua.match(/Chrome\/([0-9.]+)/i);
        browser = `Google Chrome ${match ? match[1].split('.')[0] : ''}`.trim();
    } else if (/Safari\/([0-9.]+)/i.test(ua) && !/Chrome/i.test(ua)) {
        const match = ua.match(/Version\/([0-9.]+)/i);
        browser = `Safari ${match ? match[1].split('.')[0] : ''}`.trim();
    } else if (/Firefox\/([0-9.]+)/i.test(ua)) {
        const match = ua.match(/Firefox\/([0-9.]+)/i);
        browser = `Mozilla Firefox ${match ? match[1].split('.')[0] : ''}`.trim();
    }

    // 2. Detect Operating System & Device Category
    let device = 'Desktop / PC';
    if (/iPhone/i.test(ua)) {
        const match = ua.match(/OS ([0-9_]+)/i);
        const version = match ? match[1].replace(/_/g, '.') : '';
        device = `Apple iPhone (iOS ${version})`.trim();
    } else if (/iPad/i.test(ua)) {
        const match = ua.match(/OS ([0-9_]+)/i);
        const version = match ? match[1].replace(/_/g, '.') : '';
        device = `Apple iPad (iPadOS ${version})`.trim();
    } else if (/Android/i.test(ua)) {
        const match = ua.match(/Android\s+([0-9.]+)/i);
        const version = match ? match[1] : '';
        const isMobile = /Mobile/i.test(ua);
        device = `Android ${version} (${isMobile ? 'Smartphone' : 'Tablet'})`.trim();
    } else if (/Windows NT 10\.0/i.test(ua)) {
        device = 'Windows 10 / 11 (PC)';
    } else if (/Windows NT 6\.3/i.test(ua)) {
        device = 'Windows 8.1 (PC)';
    } else if (/Windows NT 6\.1/i.test(ua)) {
        device = 'Windows 7 (PC)';
    } else if (/Macintosh|Mac OS X/i.test(ua)) {
        const match = ua.match(/Mac OS X ([0-9_]+)/i);
        const version = match ? match[1].replace(/_/g, '.') : '';
        device = `macOS ${version} (Mac)`.trim();
    } else if (/Linux/i.test(ua)) {
        device = 'Linux (PC)';
    }

    return {
        browser,
        device,
        raw: ua
    };
}

function getClientIp(req) {
    if (!req) return '127.0.0.1';

    let ip = '';
    const forwarded = req.headers ? (req.headers['x-forwarded-for'] || req.headers['x-real-ip']) : null;
    if (forwarded) {
        ip = typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : forwarded[0];
    }

    if (!ip && req.socket && req.socket.remoteAddress) {
        ip = req.socket.remoteAddress;
    }

    if (!ip && req.ip) {
        ip = req.ip;
    }

    // Normalize IPv6 mapped IPv4 and loopbacks
    if (ip) {
        ip = ip.replace(/^::ffff:/, '');
        if (ip === '::1') ip = '127.0.0.1';
    } else {
        ip = '127.0.0.1';
    }

    return ip;
}

function estimateLocation(ip, req = null) {
    // Check if localhost or private RFC1918 network
    if (!ip || ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.') || /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip)) {
        return 'Lokal / Jaringan Internal (Private)';
    }

    // Check optional Cloudflare / CDN proxy geolocation headers if running behind reverse proxy
    if (req && req.headers) {
        const city = req.headers['cf-ipcity'] || req.headers['x-city'];
        const country = req.headers['cf-ipcountry'] || req.headers['x-country-name'];
        if (city && country) {
            return `${city}, ${country} (Perkiraan Jaringan)`;
        }
        if (country) {
            return `${country} (Perkiraan Jaringan)`;
        }
    }

    // Safe general estimate disclaimer as mandated by security requirement
    return 'Indonesia (Perkiraan Jaringan)';
}

module.exports = {
    parseUserAgent,
    getClientIp,
    estimateLocation
};
