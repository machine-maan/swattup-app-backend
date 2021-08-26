const express = require('express')
const logger = require('morgan')
const bodyParser = require('body-parser')
const cors = require('cors')
const path = require('path')
const pdf = require('express-pdf')

const routes = require('./routes/index')
const files = require('./helpers/files')
const adminConfig = require('./helpers/adminConfig')
const fileupload = require('express-fileupload')
const cronHelper = require('./helpers/cronHelper')
const seeder = require('./seeder')
const compression = require('compression')
const xss = require('xss-clean');
const mongoSanitize = require('express-mongo-sanitize');
const { errorConverter, errorHandler } = require('./middleware/error');
const httpStatus = require('http-status');
const ApiError = require('./utils/ApiError');

require('dotenv').config()

const app = express()
app.use(function (req, res, next) {
    res.header('Access-Control-Allow-Origin', '*')
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    res.header(
        'Access-Control-Allow-Headers',
        'Origin, X-Requested-With, Content-Type, Accept'
    )
    next()
})

app.use(cors())
app.use(logger('dev'))
app.use(pdf)
// app.use(bodyParser.json({ limit: '50mb' }))
// app.use(bodyParser.urlencoded({ limit: '50mb', extended: false }))

// parse json request body
app.use(express.json());

// parse urlencoded request body
app.use(express.urlencoded({ extended: true }));

app.use(express.static('./public'))
app.use(express.static('./tmp'))
// app.use(express.static(path.join(__dirname, 'public')));
app.use(
    fileupload({
        useTempFiles: true,
        tempFileDir: '/tmp/',
    })
)

exports.debug = process.env.COMPUTERNAME === 'xxx'

console.log('Debug:', exports.debug)

// sanitize request data
app.use(xss());
app.use(mongoSanitize());

// gzip compression
app.use(compression());

// redirect http to https
// (disable for dev so localhost works, and also for ./well-known/ so https verification works if https is down)

// !exports.debug &&
//   process.env.NODE_ENV !== 'development' &&
//   app.use((req, res, next) => {
//     if (
//       !req.secure &&
//       req.get('X-Forwarded-Proto') !== 'https' &&
//       !req.url.startsWith('/.well-known/')
//     ) {
//       res.redirect('https://' + req.get('Host') + req.url)
//     } else next()
//   })

// redirect root (hub.swattup.com) to dashboard (hub.swattup.com/dashboard)
app.get('/', (req, res) => res.redirect('/dashboard'))

// main back-end routes
app.use('/api', routes)

// https acme challenge - to verify, create doc in mLab configs that has { name: label, note: code }
app.get('/.well-known/pki-validation/:label', adminConfig.displayAcmeCode)

// privacy and terms documents
// const privacyURL = "https://s3.eu-west-2.amazonaws.com/swattup-public/images/privacy.pdf"

app.use('/privacy', (req, res) => {
    res.pdf(path.resolve(__dirname, './documents/privacy.pdf'))
})

app.use('/terms', (req, res) => {
    res.pdf(path.resolve(__dirname, './documents/terms.pdf'))
})

app.use('/app', (req, res) => files.appStoreRedirect(req, res))

// built dashboard in "build" folder ("npm run build" in project). this line should be below the routes above
app.use(express.static(path.join(__dirname, 'build')))

// not found page i.e. everything else - show dashboard
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'build/index.html'))
    // res.send("Page not found.")
})

//Data-Seedings
seeder();

//CRON
cronHelper();

// send back a 404 error for any unknown api request
app.use((req, res, next) => {
    next(new ApiError(httpStatus.NOT_FOUND, 'Route not found'));
});

// convert error to ApiError, if needed
app.use(errorConverter);

// handle error
app.use(errorHandler);

// start server
const port = process.env.PORT || 3001

app.listen(port, () => {
    console.log('server is running on', port)
})
