const { parse } = require('url');
const querystring = require('querystring');
const { getScreenshot } = require('./chromium');
const { getInt, getUrlFromPath, isValidUrl } = require('./validator');

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
            if (qstring) url += '?' + qstring;
            const file = await getScreenshot(url, type, qual, fullPage, viewport, wait);
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
