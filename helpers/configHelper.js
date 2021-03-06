const uploadHelper = require("./uploadHelper");

// UserTypes
const USER_TYPE_LEARNER = 'Learner';
const USER_TYPE_PROFESSIONAL = 'Professional';

//Support Crowd
const SUPPORT_CROWD = {
    _id: 'support_1',
    interestName: 'Support',
    image: uploadHelper.S3BUCKETURL + 'support/support.png',
    createdAt: new Date(),
};

// Auth Providers
const AUTH_PROVIDER_GOOGLE = 'google';
const AUTH_PROVIDER_TWITTER = 'twitter';
const AUTH_PROVIDER_EMAIL = 'email';
const AUTH_PROVIDER_APPLE = 'apple';
const AUTH_PROVIDER_FACEBOOK = 'facebook';
const AUTH_PROVIDERS = [
    AUTH_PROVIDER_GOOGLE, 
    AUTH_PROVIDER_TWITTER, 
    AUTH_PROVIDER_EMAIL, 
    AUTH_PROVIDER_APPLE, 
    AUTH_PROVIDER_FACEBOOK,
]

const BOOK_CALL_TIME_LIMIT = 30; // in minutes
const BOOK_CALL_TIME_BUFFER = 15; // in minutes
const BOOK_CALL_EXTEND_COUNT_LIMIT = 1; // count

const BOOK_CHARGE_STATUS_PENDING = 'pending';
const BOOK_CHARGE_STATUS_FAILED = 'failed';
const BOOK_CHARGE_STATUS_SUCCEEDED = 'succeeded';
const BOOK_CHARGE_STATUS = [
    BOOK_CHARGE_STATUS_PENDING, 
    BOOK_CHARGE_STATUS_FAILED, 
    BOOK_CHARGE_STATUS_SUCCEEDED,
]
const BOOK_CALL_STATUS_ONGOING = 'ongoing';
const BOOK_CALL_STATUS_PENDING = 'pending';
const BOOK_CALL_STATUS_MISSED = 'missed';
const BOOK_CALL_STATUS_COMPLETED = 'completed';
const BOOK_CALL_STATUS = [
    BOOK_CALL_STATUS_ONGOING,
    BOOK_CALL_STATUS_PENDING,
    BOOK_CALL_STATUS_MISSED,
    BOOK_CALL_STATUS_COMPLETED,
]
//KnowledgeBank
const KNOWLEDGEBANK_VIDEO_STATUS_ENQUEUED = 'enqueued';
const KNOWLEDGEBANK_VIDEO_STATUS_STARTED = 'started';
const KNOWLEDGEBANK_VIDEO_STATUS_PROGRESS = 'progress';
const KNOWLEDGEBANK_VIDEO_STATUS_COMPLETED = 'completed';
const KNOWLEDGEBANK_VIDEO_STATUS = [
    KNOWLEDGEBANK_VIDEO_STATUS_ENQUEUED,
    KNOWLEDGEBANK_VIDEO_STATUS_STARTED,
    KNOWLEDGEBANK_VIDEO_STATUS_PROGRESS,
    KNOWLEDGEBANK_VIDEO_STATUS_COMPLETED,
];

const SIGNUP_VERIFICATION_CODE_EXPIRY = 30; // in minutes
const SIGNUP_EMAIL_VERIFICATION_LIMIT = 5; // 5 times per day

const PAGINATION_DATA_LIMIT = 10; // 10 records per page

module.exports = Object.freeze({
    SECRET_KEY: '123456',
    EXPIRES_IN: '365d', //60 * 24 * 365
    USER_TYPE_LEARNER: USER_TYPE_LEARNER,
    USER_TYPE_PROFESSIONAL: USER_TYPE_PROFESSIONAL,
    USER_TYPE: [
        USER_TYPE_LEARNER,
        USER_TYPE_PROFESSIONAL
    ],
    SUPPORT_CROWD: SUPPORT_CROWD,
    AUTH_PROVIDER_GOOGLE: AUTH_PROVIDER_GOOGLE,
    AUTH_PROVIDER_TWITTER: AUTH_PROVIDER_TWITTER,
    AUTH_PROVIDER_EMAIL: AUTH_PROVIDER_EMAIL,
    AUTH_PROVIDER_APPLE: AUTH_PROVIDER_APPLE,
    AUTH_PROVIDER_FACEBOOK: AUTH_PROVIDER_FACEBOOK,
    AUTH_PROVIDERS: AUTH_PROVIDERS,
    SOURCE_PROVIDERS: AUTH_PROVIDERS,
    SOURCE_PROVIDER_EMAIL: AUTH_PROVIDER_EMAIL,
    BOOK_CALL_TIME_LIMIT: BOOK_CALL_TIME_LIMIT,
    BOOK_CALL_TIME_BUFFER: BOOK_CALL_TIME_BUFFER,
    BOOK_CALL_EXTEND_COUNT_LIMIT: BOOK_CALL_EXTEND_COUNT_LIMIT,
    BOOK_CHARGE_STATUS: BOOK_CHARGE_STATUS,
    BOOK_CHARGE_STATUS_PENDING: BOOK_CHARGE_STATUS_PENDING,
    BOOK_CHARGE_STATUS_FAILED: BOOK_CHARGE_STATUS_FAILED,
    BOOK_CHARGE_STATUS_SUCCEEDED: BOOK_CHARGE_STATUS_SUCCEEDED,
    BOOK_CALL_STATUS: BOOK_CALL_STATUS,
    BOOK_CALL_STATUS_PENDING: BOOK_CALL_STATUS_PENDING,
    BOOK_CALL_STATUS_ONGOING: BOOK_CALL_STATUS_ONGOING,
    BOOK_CALL_STATUS_MISSED: BOOK_CALL_STATUS_MISSED,
    BOOK_CALL_STATUS_COMPLETED: BOOK_CALL_STATUS_COMPLETED,
    KNOWLEDGEBANK_VIDEO_STATUS: KNOWLEDGEBANK_VIDEO_STATUS,
    KNOWLEDGEBANK_VIDEO_STATUS_ENQUEUED : KNOWLEDGEBANK_VIDEO_STATUS_ENQUEUED,
    KNOWLEDGEBANK_VIDEO_STATUS_STARTED : KNOWLEDGEBANK_VIDEO_STATUS_STARTED,
    KNOWLEDGEBANK_VIDEO_STATUS_PROGRESS : KNOWLEDGEBANK_VIDEO_STATUS_PROGRESS,
    KNOWLEDGEBANK_VIDEO_STATUS_COMPLETED : KNOWLEDGEBANK_VIDEO_STATUS_COMPLETED,
    SIGNUP_VERIFICATION_CODE_EXPIRY: SIGNUP_VERIFICATION_CODE_EXPIRY,
    SIGNUP_EMAIL_VERIFICATION_LIMIT: SIGNUP_EMAIL_VERIFICATION_LIMIT,
    PAGINATION_DATA_LIMIT: PAGINATION_DATA_LIMIT,
});