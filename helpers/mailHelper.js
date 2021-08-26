var nodemailer = require('nodemailer')

let transporter = nodemailer.createTransport({
    // host: process.env.EMAIL_HOST,
    // port: process.env.EMAIL_PORT,
    // secure: true,
    // requireTLS: process.env.EMAIL_USE_TLS,
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_HOST_USER,
        pass: process.env.EMAIL_HOST_PASSWORD,
    },
    // tls: { rejectUnauthorized: true },
})

async function emailVerification(code, userData, mailCallback = null) {
    let userNameMail = userData.username ? userData.username : 'User';

    return processSend({
        to: userData.email,
        subject: 'Welcome to SwattUp! Your code is:' + `${code}`,
        html:
            `Hey <b>` + userNameMail + `</b>,` +
            `<br><br>Thanks for signing up to SwattUp.<br>` +
            `The code to verify your email address is <b>` + code + `</b>. ` +
            `If you ever need help or want to get in touch, send us an email at hello@swattup.com` +
            `<br><br><i><b>Note:</b> Verification code will be expire in 30 minutes.</i>` +
            `<br><br>Happy Swatting!<br><b>The SwattUp Team</b>`,
    }, mailCallback);
}

const forgotPassword = (code, userData, mailCallback = null) => {
    let userNameMail = userData.username ? userData.username : 'User';

    return processSend({
        to: userData.email,
        subject: 'SwattUp Password Reset! Your code is:' + `${code}`,
        html:
            'Hey <b>' + userNameMail +
            '</b><br>The code to reset your account password is <b>' + code + '</b>. If you ever need help or want to get in touch, send us an email at hello@swattup.com.<br><br>Happy Swatting!<br><b>The SwattUp Team</b>',
    }, mailCallback);
}

const resetPassword = (userData, mailCallback = null) => {
    let userNameMail = userData.username ? userData.username : 'User';

    return processSend({
        to: userData.email,
        subject: 'SwattUp Password Reset Successfully!',
        html:
            'Hey <b>' +
            userNameMail +
            '</b><br>You have successfully reset your password. If you ever need help or want to get in touch, send us an email at hello@swattup.com.<br><br>Happy Swatting!<br><b>The SwattUp Team</b>',
    }, mailCallback);
}

const processSend = (mailOptions, mailCallback) => {
    mailOptions['from'] = process.env.EMAIL_HOST_USER;

    if (mailCallback) {
        return send(mailOptions, mailCallback);
    }

    send(mailOptions);
}

async function send(mailOptions, callback = null) {
    transporter.sendMail(mailOptions, function (error, success) {
        if (error) {
            console.log(error)
        } else {
            console.log('email is send')
        }
        if (callback) {
            return callback(error, success)
        }
    })
}

module.exports = {
    emailVerification: emailVerification,
    forgotPassword,
    resetPassword,
}