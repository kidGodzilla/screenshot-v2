const md5 = require('md5');
const { parse } = require('url');
const querystring = require('querystring');
const { getScreenshot } = require('./chromium');
const { getInt, getUrlFromPath, isValidUrl } = require('./validator');

const { BUNNY_STORAGE_API_KEY, BUNNY_API_KEY } = process.env;
const CDN_URL = 'https://sshots.b-cdn.net';
const BUCKET_NAME = 'sshots';
const DEFAULT_PATH = '/';

let TTL = 3 * 24 * 60 * 60 * 1000; // Three days

// Put a file in the bunny CDN
function putFile (bucket, fn, file, cb) {

    let url = 'https://storage.bunnycdn.com/' + bucket + fn;
    if (!file) file = '0';

    request({
        method: 'PUT',
        url: url,
        headers: { 'AccessKey': BUNNY_STORAGE_API_KEY },
        body: file
    }, (error, response, body) => {
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
        const { type = 'png', quality, height, width, dpr, fullPage, wait } = query;
        const qstring = querystring.stringify(query);
        let url = getUrlFromPath(pathname);

        var viewport = null;

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
            var ts = Math.floor((+ new Date) / TTL); // TTL-unique slug
            var requestMd5 = md5(url); // md5 of request string
            var filename = requestMd5 + '-' + ts + '.' + type;
            console.log('Expected cached filename:', filename);

            // Todo: Check to see if the filename exists at -- CDN_URL + '/' + filename

            const file = await getScreenshot(url, type, qual, fullPage, viewport, wait);

            putFile(BUCKET_NAME, filename, file, (ress) => {});

            res.statusCode = 200;
            res.setHeader('Content-Type', `image/${type}`);
            res.end(file);
        }
    } catch (e) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'text/html');
        res.end('<h1>Server Error</h1><p>Sorry, there was a problem</p>');
        console.error(e.message);
    }
};
