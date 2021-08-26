const mongoose = require('mongoose');
const Ffmpeg = require('fluent-ffmpeg')
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffprobePath = require('@ffprobe-installer/ffprobe').path;
Ffmpeg.setFfmpegPath(ffmpegPath);
Ffmpeg.setFfprobePath(ffprobePath);

const CROWD_GOAL_PATH = 'crowds/goal/';
const CROWD_TOPIC_PATH = 'crowds/topic/';
const USER_PROFILE_PATH = 'users/profile/';
const COACH_PROFILE_PATH = 'coach/profile/images/';
const COACH_PROFILE_VIDEO_PATH = 'coach/profile/videos/';
const COACH_VIDEO_PATH = 'coach/videos/';
const CHAT_FILE_PATH = 'users/chat/';
const ANSWER_IMAGE_FILE_PATH = 'questions/answers/images/';
const ANSWER_VIDEO_FILE_PATH = 'questions/answers/videos/';
const COMMENT_IMAGE_FILE_PATH = 'questions/comments/images/';
const COMMENT_VIDEO_FILE_PATH = 'questions/comments/videos/';
const KNOWLEDGEBANK_PATH = 'users/knowledgeBank/';
const VIDEO_THUMBNAILS_DIRECTORY = 'thumbnails';
const video_size_limit = 52428800; //31457280
const fs = require('fs')
const path = require('path')
const AWS = require('aws-sdk');
AWS.config.update({ region: 'us-west-2' });
var uuidv4 = require('uuid/v4');
var request = require('request');
const sharp = require('sharp');
const imageExtensions = ['jpg', 'jpeg', 'png', 'gif'];
const videoExtensions = ['mov', 'mp4', 'mp3'];
const imageOptimizeSize = [
    640,
    480,
];

const S3BUCKETURL = "https://swattup-app-bucket.s3.eu-west-2.amazonaws.com/";
const AWS_ACCESS_KEY = "AKIASW4K5WL2ERJS7HG2";
const AWS_SECRET_ACCESS_KEY = "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";
const BUCKET_NAME = "swattup-app-bucket";
const s3 = new AWS.S3({
    accessKeyId: AWS_ACCESS_KEY,
    secretAccessKey: AWS_SECRET_ACCESS_KEY
});

async function upload(files, key, fileType, dir, s3Path, ext = [], sizeLimit = null, oldImage = null) {
    let res = {
        status: false,
        message: 'Request file not processed',
    };

    if (!files) {
        return res;
    }
    if (!files[key]) {
        return res;
    }

    let baseName = files[key];
    console.log('baseName...>>>>..', baseName);
    if (fileType == 'video') {
        const vSize = sizeLimit ? sizeLimit : video_size_limit;
        if (baseName.size > vSize) {
            res.message = 'Video size should not be more than ' + vSize / 1048576 + ' MB';

            return res;
        }
    }

    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
    }

    if (ext.length === 0) {
        if (fileType == 'video') {
            ext = videoExtensions;
        } else {
            ext = imageExtensions;
        }
    }

    let uuidName = uuidv4();
    let fileName = uuidName + path.extname(baseName.name)
    let regexString = ext.join('|');
    let regex = new RegExp(".(" + regexString + ")$", 'i');
    if (!fileName.match(regex)) {
        return {
            status: false,
            message: 'Invalid ' + fileType + ' extension',
        };
    }
    let newpath = dir + fileName

    if (oldImage) {
        if (fileType == 'video') {
            await deleteVideo(oldImage);
        } else {
            await deleteImage(oldImage);
        }
    }

    await baseName.mv(newpath);
    let optimizedImage = newpath;
    let thumbnail = null;
    if (fileType == 'image') {
        if (path.extname(baseName.name) != '.gif') {
            optimizedImage = await optimizeImage(dir, fileName);
        }
    } else if (fileType == 'video') {
        generateVideoThumbnail(dir, newpath, s3Path, uuidName);
    }

    s3filedata = await uploadToS3Bucket(optimizedImage, s3Path + fileName);

    console.log('Video>>>>>> Completed.......');
    res['status'] = true;
    res['message'] = 'File uploaded successfully';
    res['thumbnail'] = thumbnail;
    res[key] = s3filedata.Location;
    // res[key] = fileName;
    fs.unlinkSync(optimizedImage)

    return res;
}

async function optimizeImage(imagePath, imageName) {
    let originalImage = imagePath + imageName;
    let compressedImage = imagePath + 'c_' + imageName;

    await sharp(originalImage)
        .resize(...imageOptimizeSize)
        .jpeg({ quality: 80, mozjpeg: true, progressive: true, force: false })
        .png({ quality: 80, progressive: true, force: false })
        .toFile(compressedImage);

    fs.unlinkSync(originalImage)

    return compressedImage;
}

function uploadToS3Bucket(filePath, fileName) {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            const fileContent = fs.readFileSync(filePath);
            const s3 = new AWS.S3({
                accessKeyId: AWS_ACCESS_KEY,
                secretAccessKey: AWS_SECRET_ACCESS_KEY
            });

            const params = {
                Bucket: BUCKET_NAME,
                Key: fileName,
                Body: fileContent,
                ACL: 'public-read',
            };
            var s3upload = s3.upload(params).promise();
            resolve(s3upload)
        }, 500);
    });
}

function deleteFromS3Bucket(fileName) {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            const params = {
                Bucket: BUCKET_NAME,
                Key: fileName,
            };
            var s3delete = s3.deleteObject(params).promise();
            resolve(s3delete)
        }, 500);
    });
}

async function deleteImage(image) {
    return await deleteFromS3Bucket(image.replace(S3BUCKETURL, ""));
}

async function uploadWeb(fileUrl, filePath, fileName, callback) {
    request({
        url: fileUrl,
        encoding: null
    }, function (err, res, body) {
        if (err)
            return callback(err, res);

        let localPath = './public/' + filePath;
        if (!fs.existsSync(localPath)) {
            fs.mkdirSync(localPath, { recursive: true })
        }
        let explodedArray = fileName.split('.');
        generateVideoThumbnail(localPath, fileUrl, filePath, explodedArray[0]);

        s3.putObject({
            Bucket: BUCKET_NAME,
            Key: filePath + fileName,
            ContentType: res.headers['content-type'],
            ContentLength: res.headers['content-length'],
            Body: body // buffer
        }, callback);
    })
}

async function generateVideoThumbnail(dirPath, videoPath, s3Path, fileName) {
    let thumbRes = await new Ffmpeg(videoPath)
        .screenshots({
            count: 1,
            size: '320x240',
            filename: fileName,
            folder: dirPath + VIDEO_THUMBNAILS_DIRECTORY,
        })
        .on("end", async function () {
            console.log('SS taken!!!');

            let s3filedata = await uploadToS3Bucket(
                dirPath + VIDEO_THUMBNAILS_DIRECTORY + '/' + fileName + '.png',
                s3Path + VIDEO_THUMBNAILS_DIRECTORY + '/' + fileName + '.png'
            );
            fs.unlinkSync(dirPath + VIDEO_THUMBNAILS_DIRECTORY + '/' + fileName + '.png');
        })
        ;

    return fileName + '.png';
}

const deleteVideo = async (videoLink) => {
    await deleteImage(videoLink);
    let expArray = videoLink.split('/');
    let lastIndex = expArray[expArray.length-1];
    let fileName = lastIndex.split('.');
    console.log('>>fileName: ', expArray, lastIndex, fileName);
    if (fileName[0]) {
        expArray.pop();
        let implodString = expArray.join('/') + '/' + VIDEO_THUMBNAILS_DIRECTORY + '/' + fileName[0] + '.png';
        console.log('>>implodString: ', implodString);
        deleteImage(implodString);
    }
}

module.exports = {
    S3BUCKETURL: S3BUCKETURL,
    CROWD_GOAL_PATH: CROWD_GOAL_PATH,
    CROWD_TOPIC_PATH: CROWD_TOPIC_PATH,
    USER_PROFILE_PATH: USER_PROFILE_PATH,
    COACH_PROFILE_PATH: COACH_PROFILE_PATH,
    COACH_PROFILE_VIDEO_PATH: COACH_PROFILE_VIDEO_PATH,
    COACH_VIDEO_PATH: COACH_VIDEO_PATH,
    CHAT_FILE_PATH: CHAT_FILE_PATH,
    ANSWER_IMAGE_FILE_PATH: ANSWER_IMAGE_FILE_PATH,
    ANSWER_VIDEO_FILE_PATH: ANSWER_VIDEO_FILE_PATH,
    COMMENT_IMAGE_FILE_PATH: COMMENT_IMAGE_FILE_PATH,
    COMMENT_VIDEO_FILE_PATH: COMMENT_VIDEO_FILE_PATH,
    KNOWLEDGEBANK_PATH: KNOWLEDGEBANK_PATH,
    VIDEO_THUMBNAILS_DIRECTORY: VIDEO_THUMBNAILS_DIRECTORY,
    upload: upload,
    uploadWeb: uploadWeb,
    deleteImage: deleteImage,
    deleteFromS3Bucket: deleteFromS3Bucket,
    deleteVideo,
}