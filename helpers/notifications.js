const db = require('../models')
var FCM = require('fcm-node');
const admin = require('firebase-admin');
const notificationLogService = require('../services/notificationLogService');
const configHelper = require('./configHelper');
const jwt = require('jsonwebtoken');
const dateHelper = require('./dateHelper');
const paginationHelper = require('./paginationHelper');
const globalHelper = require('./globalHelper');
// var serviceAccount = require("./firebase-adminSDK.json");

exports.send = (userData, title, body, typeDetail, scheduleDate = null, scheduleTime = null) => {
    var serverKey = process.env.FIREBASE_SERVER_KEY
    var fcm = new FCM(serverKey)

    // admin.initializeApp({
    //     // credential: admin.credential.cert(serviceAccount),
    //     credential: admin.credential.applicationDefault(),
    //     databaseURL: 'https://<DATABASE_NAME>.firebaseio.com'
    // });
    var dt = new Date();
    let plusThirtyMinutes = dt.setMinutes(dt.getMinutes() + 5);
    let extraData = typeDetail.extraData ? typeDetail.extraData : {};

    var message = { //this may vary according to the message type (single recipient, multicast, topic, et cetera)
        to: userData.deviceToken, 
        collapse_key: 'your_collapse_key',
        
        notification: {
            title: title, 
            body: body,
            sound: "default",
        },
        // priority: "high",
        // android: {
        //     notification: {
        //         sound: 'default'
        //     },
        // },
        // apns: {
        //     payload: {
        //         aps: {
        //             sound: 'default'
        //         },
        //     },
        // },
        data: {  //you can send only notification or only data(or include both)
            route: typeDetail.route ? typeDetail.route : '',
            id: typeDetail.uniqueId,
            ...extraData,
        },
        // apns: {
        //     // headers:{
        //     //     "apns-collapse-id": "solo_changed_administrator",
        //     //     "content-available": "1",
        //     //     "apns-priority": "10",
        //     // },
        //     headers: {
        //         'apns-priority': '10',
        //     },
        //     payload: {
        //         aps: {
        //             sound: 'default',
        //         }
        //     },
        // },
        // android: {
        //     priority: 'high',
        //     notification: {
        //         sound: 'default',
        //     },
        // }
    }

    // const payload = {
    //     notification: {
    //         title: 'Message',
    //         body: 'Just one please!'
    //     }
    // };
    // admin.messaging().sendToDevice(userData.deviceToken, payload).then(response => {
    //     console.log('Done!!!!!!!!!', response.results[0].error);
    // });
    fcm.send(message, function(err, response){
        if (err) {
            console.log('notification not sent!!!', err);

            return false;
        } else {            
            let authUser = globalHelper.authUser;

            notificationLogService.insert({
                fromUser: authUser ? authUser._id : null,
                toUser: userData.id,
                deviceToken: userData.deviceToken,
                title: title,
                description: body,
                uniqueId: typeDetail.uniqueId,
                type: typeDetail.type,
                route: typeDetail.route ? typeDetail.route : '',
                extraData: extraData,
                date: new Date().toISOString(),
            });
            console.log('notification sent successfully:))');

            return true;
        }
    })
}

exports.getAllNotification = async (req, res) => {
    let notificationData = await notificationLogService.find({
            toUser: req.user._id,
        }, [
        {
            $lookup: {
                from: 'users',
                localField: 'fromUser',
                foreignField: '_id',
                as: 'fromUserData',
            }
        },
        {$unwind:{ path: '$fromUserData', "preserveNullAndEmptyArrays": true }},
        {
            $sort: { date: -1 }
        }
    ], paginationHelper(req));
    
    // db.NotificationLog.find({ userId: req.user._id }, async function (
    //     err,
    //     notificationData
    // ) {
        let nRes = [];
        console.log('notificationData...', notificationData);
        nRes = notificationData.data.map(e => {
            return {
                // ...e.toJSON(),
                ...e,
                date: e.date ? dateHelper().convert(e.date) : null,
            }
        });

        return res.status(200).send({
            status: true,
            statusCode: 200,
            message: 'Notification fetched successfully',
            responseData: nRes,
            metadata: notificationData.metadata,
        })
    // })
}