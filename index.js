const fetch = require('node-fetch-polyfill');
const http = require('http');

const PORT = 3000;
const BACKSPACE = String.fromCharCode(127);
const HOST = 'localhost:8080' // 'mov-crm.us-west-2.elasticbeanstalk.com'

const getPassword = (prompt, callback) => {
    if (prompt) {
      process.stdout.write(prompt);
    }

    var stdin = process.stdin;
    stdin.resume();
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    var password = '';
    stdin.on('data', ch => {
        ch = ch.toString('utf8');

        switch (ch) {
        case "\n":
        case "\r":
        case "\u0004":
            // They've finished typing their password
            process.stdout.write('\n');
            stdin.setRawMode(false);
            stdin.pause();
            callback(false, password);
            break;
        case "\u0003":
            // Ctrl-C
            callback(true);
            break;
        case BACKSPACE:
            password = password.slice(0, password.length - 1);
            process.stdout.clearLine();
            process.stdout.cursorTo(0);
            process.stdout.write(prompt);
            process.stdout.write(password.split('').map(() => '*').join(''));
            break;
        default:
            // More passsword characters
            process.stdout.write('*');
            password += ch;
            break;
        }
    });
}

// http://mov-crm.us-west-2.elasticbeanstalk.com/deals

const onRequest = cookie => (client_req, client_res) => {
    console.log(`serve:${client_req.method} ${client_req.url}`);
  
    const options = {
      hostname: HOST.split(':')[0],
      port: parseInt(HOST.split(':')[1] ?? '80', 10),
      path: client_req.url,
      method: client_req.method,
      headers: {...client_req.headers, cookie}
    };
  
    const proxy = http.request(options, res => {
        client_res.writeHead(res.statusCode, res.headers);
        res.pipe(client_res, {end: true});
    });
  
    client_req.pipe(proxy, {
        end: true
    });
}

let getSecCookie = async password => {
    let credentials = {
        username: process.argv[2],
        password,
    };

    let response = await fetch(`http://${HOST}/login`, {
        method: 'POST',
        redirect: 'manual',
        headers: {
            'content-type': 'application/x-www-form-urlencoded'
        },
        body: Object.entries(credentials).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')
    });

    return response.headers.get('set-cookie').split(';')[0];
}

getPassword('Enter password: ', (err, password) => {
    if (err) {
        return;
    }
    getSecCookie(password).then(secCookie => {
        console.log(`Listening on port: ${PORT}`);
        http.createServer(onRequest(secCookie)).listen(PORT);
    });
});
