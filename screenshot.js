const md5 = require('md5');
const { parse } = require('url');
const request = require('request');
const querystring = require('querystring');
const { getScreenshot } = require('./chromium');
const urlExists = require('url-exists-async-await');
const { getInt, getUrlFromPath, isValidUrl } = require('./validator');

let { BUNNY_STORAGE_API_KEY, BUNNY_API_KEY, TTL } = process.env;
if (!TTL) TTL = 3 * 24 * 60 * 60 * 1000; // Three days
const CDN_URL = 'https://sshots.b-cdn.net';
const BUCKET_NAME = 'sshots';


// Put a file in the Bunny CDN
function putFile (bucket, fn, file, cb) {
    let url = 'https://storage.bunnycdn.com/' + bucket + fn;
    if (!file) file = '0';

    request({
        headers: { 'AccessKey': BUNNY_STORAGE_API_KEY },
        method: 'PUT',
        body: file,
        url: url
    }, (error, response, body) => {
        if (cb && typeof cb == 'function') cb({
            status: response.statusCode,
            headers: response.headers,
            body: body
        });
    });
}

// Purge a specific URL from Bunny CDN
function purgeUrl (url, cb) {
    if (!BUNNY_API_KEY || !url) {
        if (cb && typeof cb == 'function') cb();
        return;
    }
    request({
        method: 'POST',
        url: 'https://bunnycdn.com/api/purge?url=' + encodeURIComponent(url),
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'AccessKey': BUNNY_API_KEY
        }}, function (error, response, body) {
        if (cb && typeof cb == 'function') cb({
            status: response.statusCode,
            headers: response.headers,
            body: body
        });
    });
}


module.exports = async function (req, res) {
    try {
        const { pathname = '/', query = {} } = parse(req.url, true);
        const { type = 'png', quality, height, width, dpr, fullPage, wait, cache } = query;
        const qstring = querystring.stringify(query);
        let url = getUrlFromPath(pathname);
        let viewport = null;

        if (width || height || dpr) viewport = {
            width: parseInt(width, 10) || 960,
            height: parseInt(height, 10) || 640,
            deviceScaleFactor: parseInt(dpr, 10) || 2
        };

        const qual = getInt(quality);

        if (!isValidUrl(url)) {
            res.statusCode = 400;
            res.setHeader('Content-Type', 'text/html');
            res.end(`<h1>Bad Request</h1><p>The url <em>${url}</em> is not valid.</p>`);

        } else {
            // Append query string to url
            if (qstring) url += '?' + qstring;

            // Check for a CDN cache
            const ts = Math.floor((+ new Date) / TTL); // TTL-unique slug
            url = url.replace('&cache=false', '');

            const requestMd5 = md5(url); // md5 of request string
            const filename = requestMd5 + '-' + ts + '.' + type;

            // Check to see if the filename exists at -- CDN_URL + '/' + filename
            let exists = false;

            if (cache !== '0' && cache !== 'false')
                exists = await urlExists(CDN_URL + '/' + filename);

            if (exists) {
                // Redirect to the image
                res.writeHead(301, { Location: CDN_URL + '/' + filename });
                res.end();

            } else {
                // Take a screenshot
                const file = await getScreenshot(url, type, qual, fullPage, viewport, wait);

                purgeUrl(CDN_URL + '/' + filename, function () {
                    putFile(BUCKET_NAME, '/' + filename, file, (ress) => {
                        res.statusCode = 200;
                        res.setHeader('Content-Type', `image/${type}`);
                        res.end(file);
                    });
                });
            }
        }
    } catch (e) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'text/html');
        res.end('<h1>Server Error</h1><p>Sorry, there was a problem</p>');
        console.error(e.message);
    }
};
