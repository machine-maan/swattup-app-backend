const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const authSecret = process.env.TWILIO_AUTH_SECRET;
const authAPIKey = process.env.TWILIO_API_KEY;
let Twilio = require('twilio');
const compositionResource = require('../resources/compositionResource');
const participantResource = require('../resources/participantResource');
const roomResource = require('../resources/roomResource');
const commonHelper = require('./commonHelper');
const knowledgeBankService = require('../services/knowledgeBankService');
const fs = require('fs');
const { request } = require('http');
const configHelper = require('./configHelper');
var uuidv4 = require('uuid/v4');
const mongoose = require('mongoose');
const ObjectId = mongoose.Types.ObjectId;
const uploadHelper = require('./uploadHelper');
const knowledgeBankResource = require('../resources/knowledgeBankResource');
const userService = require('../services/userService');
const bookCallService = require('../services/bookCallService');
const globalHelper = require('./globalHelper');
const notifications = require('./notifications');
const stripeHelper = require('./stripeHelper');
const notificationHelper = require('./notificationHelper');

function TwilioS() {
    return new Twilio(accountSid, authToken);
}

function TwilioClient() {
    return new Twilio(authAPIKey, authSecret, {accountSid: accountSid});
}

exports.createRoom = async (req, res) => {
    let client = TwilioS();

    if (!req.body.roomName) {
        console.log('req.body.roomName not proper..', req.body.roomName);

        return res.status(422).send({
            success: false,
            message: 'RoomName is invalid',
        })
    }

    let roomName;
    try {
        roomName = ObjectId(req.body.roomName);
    } catch(e) {
        return res.status(422).send({
            success: false,
            message: 'RoomName is invalid',
        })
    }

    let bookCount = await bookCallService.count({
        _id: roomName,
    });
    if (!bookCount) {
        return res.status(404).send({
            success: false,
            message: 'Booking not found',
        })
    }

    let [
        compostionList,
        roomDetail,
    ] = await Promise.all([
        getAllCompositionHooks(),
        client.video.rooms(req.body.roomName)
            .fetch()
            .then(room => room)
            .catch(e => null)
    ]);

    if (!compostionList.length) {
        let compositionHook = await createCompositionHook(req);
        console.log('compositionHook...', compositionHook);
    }
    
    if (roomDetail) {
        sendCall(roomName);
        return res.status(200).send({
            success: true,
            message: 'Room already created',
            data: roomResource(roomDetail, getAccessToken()),
        })
    }

    client
        .video
        .rooms
        .create({
            recordParticipantsOnConnect: true,
            statusCallback: req.protocol + '://' + req.get('host') + '/api/room-callback',
            statusCallbackMethod: 'POST',
            type: 'group', //values: go, peer-to-peer, group-small & group
            uniqueName: req.body.roomName,
            maxParticipants: 2,
        })
        .then(async (room) => {
            console.log('RoomID:>>>>> ', room);
            sendCall(roomName);

            return res.send({
                success: true,
                message: 'Room created',
                data: roomResource(room, getAccessToken()),
            })
        })
        .catch((e) => {
            console.log('Error..', e);

            return res.status(400).send({
                success: false,
                message: 'Room not created',
                data: '' + e,
            })
        });
}

async function sendCall(roomName) {
    let bookingData = await bookCallService.getAll({
        _id: roomName,
    });
    console.log('sendCall..', bookingData);
    if (!bookingData.length) {
        return false;
    }

    bookingData = bookingData[0];
    console.log('bookingData...', bookingData);
    let authUser = globalHelper.authUser;
    let notifToken = null;
    let notifUser = null;
    if (authUser.type == configHelper.USER_TYPE_LEARNER) {
        notifToken = getAccessToken(bookingData.coachUserId.toString()).token;
        notifUser = bookingData.coach;
    } else {
        notifToken = getAccessToken(bookingData.learnerUserId.toString()).token;
        notifUser = bookingData.user;
    }

    console.log('notifUser.....', notifUser, authUser);
    console.log('roomName.....', roomName);
    if (notifToken && notifUser) {
        if (!notifUser.deviceToken) {
            console.log('notifUser.deviceToken not available');

            return false;
        }
        notifications.send({
                id: notifUser._id,
                deviceToken: notifUser.deviceToken,
            },
           (notifUser.username ? notifUser.username : '') + ' is calling you',
           'Title: ' + bookingData.title,
           {
                uniqueId: bookingData._id.toString(),
                type: 'VIDEO-CALLING',
                route: 'drawer', //videoCalling, coachdashboard
                extraData : {
                    roomName: roomName,
                    userId: notifUser._id,
                    token: notifToken,
                    callEndDate: bookingData.callEndDate,
                }
           }
        );
    }    
}

async function getSingleRoom(rooomSid) {
    let client = TwilioS();

    return client
    .video
    .rooms(rooomSid)
    .fetch()
    .then(async (room) => {
        let participants = [];
        // if (room) {
        //     participants = await getAllParticipantByRoom(room.sid);
        // }

        return roomResource(room, {
            participants: participants,
        });
    });
}

exports.getSingleRoom = async (req, res) => {
    let roomDetail = await getSingleRoom(req.params.sid);

    return res.send({
        success: true,
        message: 'Room fetched successfully',
        data: roomDetail,
    })
}
            
exports.getRoomByName = async (roomName) => {
    let client = TwilioS();
    return client.video.rooms(roomName)
            .fetch()
            .then(room => room)
            .catch(e => null);
}

exports.updateRoomCommon = async (sid, body) => {
    let client = TwilioS();

    return client.video.rooms(sid)
        .update(body) // {status: 'completed'}
        .then((updateRoom) => {
            console.log('UpdateRoom..>>>>>', updateRoom);
            return updateRoom;
        })
        .catch((e) => {
            console.log('UpdateRoom Error..', e);
            return null;
        })
    ;
}

exports.updateRoom = async (req, res) => {
    if (!req.params.sid) {
        console.log('UpdateRoom Error:...Invalid Roomid');
        
        return res.status(422).send({
            success: false,
            message: 'Room is invalid',
        })
    }
    
    let result = await this.updateRoomCommon(req.params.sid, req.body);
    if (result) {
        return res.status(200).send({
            success: true,
            message: 'Room updated',
            data: roomResource(result),
        })
    }

    return res.status(400).send({
        success: false,
        message: 'Failed to update room',
    })
}

exports.getAllRoom = async (req, res) => {
    let client = TwilioClient();
    console.log('req.query...', req.query);
    let query = req.query ? req.query : {};

    let allRooms = [];
    if (Object.keys(query).length == 0) {
        let completedRoom = await client.video.rooms.list({status: 'completed'});
        let inProgressRoom = await client.video.rooms.list({status: 'in-progress'});
        allRooms = [
            ...completedRoom,
            ...inProgressRoom
        ];
    } else {
        allRooms = await client.video.rooms.list(query);
    }
    
    let responseData = [];
    await Promise.all(
        allRooms.map(async (sRoom) => {
            // let participants = await getAllParticipantByRoom(sRoom.sid);
            let participants = [];

            responseData.push(roomResource(sRoom, {
                participants: participants,
            }));
        })
    );

    return res.send({
        success: true,
        message: 'All Room fetched successfully',
        data: responseData,
    })
}

exports.retrieveSingleParticipant = async (req, res) => {
    let client = TwilioClient();

    await client
    .video
    .rooms(req.body.roomName)
    .participants
    .get(req.params.pName) //req.user._id
    .fetch()
    .then(participant => {
        console.log('retrieve Single Participant..>>>>>', participant);

            return res.send({
                success: true,
                message: 'Retrieve Single Participant successfully',
                data: participant,
            })
    })
    .catch((e) => {
        console.log('Error..', e);

        return res.status(400).send({
            success: false,
            message: 'Participant not found',
            data: '' + e,
        })
    });
}

exports.retrieveAllParticipant = async (req, res) => {
    let participants = [];

    participants = await getAllParticipantByRoom(req.params.roomId);

    return res.send({
        success: true,
        message: 'Retrieve All Participant successfully',
        data: participants ? participants : [],
    });
}

async function getAllParticipantByRoom(roomId) {
    let client = TwilioClient();
    let participants = [];

    participants = await client
        .video
        .rooms(roomId)
        .participants
        .list({});

    if (participants) {
        participants = participants.map(e => participantResource(e));
    }

    return participants;
}

exports.getRecordingByRoom = async (req, res) => {
    let client = TwilioClient();

    await client.video.recordings
    .list({
        groupingSid: [
            req.params.roomId,
        ],
        limit: 20
    })
    // .then(recordings => recordings.forEach(r => console.log(r.sid)))
    .then(recordings => {
        console.log('retrieve recordings..>>>>>', recordings);

            return res.send({
                success: true,
                message: 'Retrieve recordings successfully',
                data: recordings,
            })
    })
    .catch((e) => {
        console.log('Error..', e);

        return res.status(400).send({
            success: false,
            message: 'Participant not found',
            data: '' + e,
        })
    });
}

function createCompositionHook(req) {
    let client = TwilioClient();

    return client.video
    .compositionHooks.
    create({
        friendlyName: 'videoCompositionHook',
        audioSources: '*',
        videoLayout: {
            grid : {
                // height: '480',
                video_sources: ['*']
            }
        },
        statusCallback: req.protocol + '://' + req.get('host') + '/api/composition-callback',
        statusCallbackMethod: 'POST',
        format: 'mp4',
        trim: true,
        // resolution: '176x144',
        resolution: '320x240',
        // resolution: '640x480',
        // resolution: '720x1080',
    })
    .then(compositionHook => {
        return compositionHook;
    })
    .catch((e) => {
        return 'Composition Error: ' + e;
    });
}

exports.createCompositionHook = async (req, res) => {
    let client = TwilioClient();

    await client.video.compositionHooks.
        // create({
        //     friendlyName: 'MyHookWithComplexVideoLayout',
        //     audioSources: '*',
        //     videoLayout: {
        //         main: {
        //             z_pos: 1,
        //             video_sources: ['student-track']
        //         },
        //         pip: {
        //             z_pos: 2,
        //             x_pos: 1000,
        //             y_pos: 30,
        //             width: 240,
        //             height: 180,
        //             video_sources: ['presenter-track']
        //         }
        //     },
        //     statusCallback: 'http://localhost:3001/api/video-callback',
        //     resolution: '1280x720',
        //     format: 'mp4'
        // })
        create({
            friendlyName: 'videoCompositionHook',
            audioSources: '*',
            videoLayout: {
                grid : {
                    // height: '480',
                    video_sources: ['*']
                }
            },
            statusCallback: req.protocol + '://' + req.get('host') + '/api/composition-callback',
            statusCallbackMethod: 'POST',
            format: 'mp4',
            trim: true,
            resolution: '176x144',
            // resolution: '720x1080',
        })
        .then(compositionHook =>{
            console.log('Created Composition Hook with SID=' + compositionHook.sid);

            return res.send({
                success: true,
                message: 'Composition Hook Created successfully',
                data: compositionHook,
            })
        })
        .catch((e) => {
            console.log('Error..', e);

            return res.status(400).send({
                success: false,
                message: 'Composition not Created',
                data: '' + e,
            })
        });
}

async function getAllCompositionHooks() {
    let client = TwilioClient();

    return client.video.compositionHooks.
        list({
            enabled: true,
        })
        .then(hooks =>{
            console.log("Found Composition Hooks.", hooks);

            return hooks ? hooks : [];
        })
        .catch((e) => {
            return [];
        })
    ;
}

exports.getAllCompositionHooks = async (req, res) => {
    let client = TwilioClient();

    await client.video.compositionHooks.
        list({
            enabled: true
        })
        .then(hooks =>{
            console.log("Found " + hooks.length + " Composition Hooks.");

            return res.send({
                success: true,
                message: 'Composition Hook Fetched successfully',
                data: hooks,
            })
        })
        .catch((e) => {
            console.log('Error..', e);

            return res.status(400).send({
                success: false,
                message: 'Composition not Fetched',
                data: '' + e,
            })
        })
    ;
}

exports.deleteCompositionHooks = async (req, res) => {
    let client = TwilioClient();

    await 
        client.video
        .compositionHooks(req.params.hookId)
        .remove()
        .then(response  =>{
            console.log("Composition Hook removed", response);

            return res.send({
                success: true,
                message: 'Composition Hook removed successfully',
            })
        })
        .catch((e) => {
            console.log('Error..', e);

            return res.status(400).send({
                success: false,
                message: 'Composition not removed',
                data: '' + e,
            })
        })
    ;
}

exports.getAllComposition = async (req, res) => {
    let client = TwilioClient();

    let query = await commonHelper.getFilterSortFields(req.query, {
        equal : {
            'roomId': {
                'key': 'roomSid',
            },
            'status': {},
        },
    });

    console.log('ppp..', query);

    client
    .video
    .compositions
    .list(query.filter)
    .then(async (compositions) => {
        let response = [];

        await Promise.all(
            compositions.map(async (e) => {
                let videoUrl = '';
                if (e.status == 'completed') {
                    videoUrl = await getCompositionMedia(e.sid);
                }
                response.push(compositionResource(e, {
                    url: videoUrl,
                }));
            })
        )

        return res.send({
            success: true,
            message: 'Composition Fetched successfully',
            data: response,
        });
    })
    .catch((e) => {
        console.log('Error..', e);

        return res.status(400).send({
            success: false,
            message: 'Composition not Fetched',
            data: '' + e,
        })
    });
}

exports.getSingleComposition = async (req, res) => {
    let client = TwilioClient();

    await  client.video
        .compositions(req.params.cId)
        .fetch()
        .then(async (hook) =>{
            console.log("Single Composition Hook.", hook);

            let videoUrl = '';
            if (hook.status == 'completed') {
                videoUrl = await getCompositionMedia(hook.sid)
            }
            hook.videoUrl = videoUrl;

            return res.send({
                success: true,
                message: 'Single composition Hook Fetched successfully',
                data: hook,
            })
        })
        .catch((e) => {
            console.log('Error..', e);

            return res.status(400).send({
                success: false,
                message: 'Single composition not Fetched',
                data: '' + e,
            })
        })
    ;
}

async function getCompositionMedia(compositionSid) {
    let client = TwilioClient();

    const uri =
    "https://video.twilio.com/v1/Compositions/" +
    compositionSid +
    "/Media?Ttl=3600";

    return client
    .request({
      method: "GET",
      uri: uri,
    })
    .then(async (response) => {
      // For example, download the media to a local file
    //   const file = fs.createWriteStream("myFile.mp4");
    //   const r = request(response.data.redirect_to);
    //   r.on("response", (res) => {
    //     res.pipe(file);
    //   });
    console.log('Media...', response);
        if (response) {
            if (response.body) {
                return response.body.redirect_to;
            }
        }
        return '';
    });
}

exports.compositionCallback = async (req, res) => {
    // let client = TwilioS();
    // console.log('compositionCallback...', req.body);
    // return res.status(200).send({
    //     success: true,
    //     message: 'compositionCallback',
    // });
    console.log('compositionCallback....<<<<<<<>>>>>>>>', req.body);
    let payload = req.body;
    let knowledgeBankData = {};
    if (payload.RoomSid && payload.CompositionSid) {
        knowledgeBankData = {
            roomId: payload.RoomSid,
            compositionId: payload.CompositionSid,
        };
        let roomDetail = await getSingleRoom(knowledgeBankData.roomId);

        if (!roomDetail.sid) {
            return res.status(404).send({
                success: false,
                message: 'Room not available',
            });
        }
        
        let participants = await getAllParticipantByRoom(payload.RoomSid);
        console.log('CompositionCallback..participants....', participants);
        if (!participants) {
            console.log('CompositionCallback...No participants available....', participants);
            return res.status(400).send({
                success: false,
                message: 'No participants available',
            });
        }
        if (participants) {
            if (participants.length > 1) {
                console.log('CompositionCallback..participants More than One....', participants);
                participants = commonHelper.removeDuplicates(participants, 'name');
                console.log('CompositionCallback...participants after reduce....', participants);
            }

            if (participants.length <= 1) {
                console.log('CompositionCallback....Less participants available....', participants);
                return res.status(400).send({
                    success: false,
                    message: 'No participants available',
                });
            }
        }

        knowledgeBankData.bookingCallId = ObjectId(roomDetail.name);

        if (payload.StatusCallbackEvent) {
            let splitArray = payload.StatusCallbackEvent.split('-');
            if (splitArray[1]) {
                let status = splitArray[1];
                if (status == 'available') {
                    knowledgeBankData.duration = parseInt(payload.Duration);
                    knowledgeBankData.size = parseInt(payload.Size);
                    status = configHelper.KNOWLEDGEBANK_VIDEO_STATUS_COMPLETED;

                    let videoUrl = await getCompositionMedia(knowledgeBankData.compositionId);
                    let filePath = uploadHelper.KNOWLEDGEBANK_PATH;
                    let fileName = uuidv4() + '.mp4';
                    knowledgeBankData.videoUrl = null;

                    var vPromise = new Promise(function (resolve, reject) {
                        uploadHelper.uploadWeb(videoUrl, filePath, fileName, async function (err, res) {
                            if (err) {
                                console.log('video error......', err);
                                reject('-');
                            } else {
                                console.log('>> video uploaded !!!!!');
                                resolve(uploadHelper.S3BUCKETURL + filePath + fileName);
                            }
                        })
                    });

                    vPromise.then(async function(successResponse) {
                        knowledgeBankData.videoUrl = successResponse;
                        await knowledgeBankService.insertOrUpdate({
                            roomId: payload.RoomSid,
                            compositionId: payload.CompositionSid,
                        }, knowledgeBankData);
                        notificationHelper.notifyOnVideoRecordingReady(knowledgeBankData);
                    });
                }
                knowledgeBankData.status = status;
            }
        }
    }

    if (Object.keys(knowledgeBankData).length) {
        let result = await knowledgeBankService.insertOrUpdate({
            roomId: payload.RoomSid,
            compositionId: payload.CompositionSid,
        }, knowledgeBankData);
        console.log('Data Insrted!!!!!!!!!...', knowledgeBankData, result);
    }

    return res.status(200).send({
        success: true,
        message: 'compositionCallback',
    })
}

exports.getAllKnowledgeBank = async (req, res) => {
    let match = {};
    let nameKey = '';
    if (req.user.type == configHelper.USER_TYPE_LEARNER) {
        match['booking.learnerUserId'] = ObjectId(req.user._id);
        nameKey = 'coach.username';
    } else {
        match['booking.coachUserId'] = ObjectId(req.user._id);
        nameKey = 'learner.username';
    }

    let searchParams = {};
    if (req.query['search']) {
        const searchValue = new RegExp(req.query['search'], 'i');
        searchParams = {
            $or: [
                {
                   'booking.title': searchValue,
                },
                {
                    'booking.description': searchValue,
                },
            ],
        };
        let matchUser = {};
        matchUser[nameKey] = searchValue;
        searchParams['$or'].push(matchUser);
    }

    let data = await knowledgeBankService.aggregate([
        {
            $lookup: {
                from: 'bookingcalls',
                localField: 'bookingCallId',
                foreignField: '_id',
                as: 'booking'
            }
        },
        { $unwind: '$booking' },
        {
            $lookup: {
                from: 'users',
                localField: 'booking.learnerUserId',
                foreignField: '_id',
                as: 'learner'
            }
        },
        { $unwind: '$learner' },
        {
            $lookup: {
                from: 'users',
                localField: 'booking.coachUserId',
                foreignField: '_id',
                as: 'coach'
            }
        },
        { $unwind: '$coach' },
        {
            $match: {
                ...match,
                ...searchParams,
            },
        },
        {
            $sort: { createdAt: -1 },
        }
    ]);

    let kRes = [];
    kRes = data.map(e => knowledgeBankResource(e));
    // await Promise.all(
    //     data.map(async (e) => {
    //         if (e.videoUrl) {
    //             await uploadHelper.deleteImage(e.videoUrl);
    //         }
    //         await knowledgeBankService.delete({
    //             _id: e._id,
    //         });
    //         // kRes.push(knowledgeBankResource(e))
    //     })
    // )


    return res.status(200).send({
        success: true,
        message: 'KnowledgeBank data fetched successfully',
        // data: req.user,
        data: kRes,
    })
}

exports.deleteS3File = async (req, res) => {
    let result = await uploadHelper.deleteImage(req.body.path);

    return res.status(200).send({
        result: result,
    })
}

exports.roomCallback = async (req, res) => {
    // let client = TwilioS();

    console.log('roomCallback....<<<<<<<<<>>>>>>>>>>', req.body);
    let payload = req.body;
    if (payload.StatusCallbackEvent == 'room-ended') {
        let participants = await getAllParticipantByRoom(payload.RoomSid);
        console.log('participants....', participants);
        if (!participants) {
            console.log('No participants available....', participants);
            return res.status(400).send({
                success: false,
                message: 'No participants available',
            });
        }
        if (participants) {
            if (participants.length > 1) {
                console.log('participants More than One....', participants);
                participants = commonHelper.removeDuplicates(participants, 'name');
                console.log('participants after reduce....', participants);
            }

            if (participants.length <= 1) {
                console.log('Less participants available....', participants);
                return res.status(400).send({
                    success: false,
                    message: 'No participants available',
                });
            }
        }
        let bookId = ObjectId(payload.RoomName);
        let roomStatus = configHelper.BOOK_CALL_STATUS_MISSED;
        let duration = parseInt(payload.RoomDuration);
        if (duration) {
            if (duration > 0) {
                roomStatus = configHelper.BOOK_CALL_STATUS_COMPLETED;
            }
        }
        let bookingUpdate = await bookCallService.update(bookId, {
            callStatus: roomStatus,
        });
        if (roomStatus == configHelper.BOOK_CALL_STATUS_COMPLETED) {
            let bookDetail = await bookCallService.getAll({
                _id: bookId,
            }, [], false);
            if (bookDetail.length) {
                console.log('bookDetail...', bookDetail);
                bookDetail = bookDetail[0];
                let learnerData = bookDetail.user_data;
                let coachData = bookDetail.coach_data;
                console.log('learnerData...', learnerData);
                console.log('coachData...', coachData);
                let paymentDetail = await stripeHelper.charge(
                    learnerData.stripeCustomerId ? learnerData.stripeCustomerId : bookDetail.stripeToken,
                    parseInt(coachData.callPrice) * 100,
                    coachData.stripeAccountId
                );

                if (paymentDetail.status) {
                    console.log('--- Room payment--- Payment deducted');
                    let bookingUpdate = await bookCallService.update(bookId, {
                        chargeId: paymentDetail.data.id,
                        chargeStatus: paymentDetail.data.status,
                        chargeCurrency: paymentDetail.data.currency,
                    });
                    if (bookingUpdate) {
                        console.log('--- Room Success--- Payment deducted & updated on table');
                    }
                } else {
                    console.log('Payment Failed...', paymentDetail.message);
                }
            } else {
                console.log('--- Room Error---Booking data not available');
            }
        }
        console.log('--- Room Completed -----', bookingUpdate);
    }

    return res.status(200).send({
        success: true,
        message: 'roomCallback',
    })
}

exports.getAccessToken = async (req, res) => {
    return res.status(200).send({
        success: true,
        message: 'getAccessToken',
    })
}

exports.updateRecordingRules = async (req, res) => {
    return res.status(200).send({
        success: true,
        message: 'updateRecordingRules',
    })
}

function getAccessToken(requestUserId = null) {
    var AccessToken = require('twilio').jwt.AccessToken;
    var VideoGrant = AccessToken.VideoGrant;

    // Substitute your Twilio AccountSid and ApiKey details
    var ACCOUNT_SID = accountSid;
    var API_KEY_SID = authAPIKey;
    var API_KEY_SECRET = authSecret;

    // Create an Access Token
    var accessToken = new AccessToken(
        ACCOUNT_SID,
        API_KEY_SID,
        API_KEY_SECRET
    );

    // Set the Identity of this token
    let userId = requestUserId ? requestUserId : globalHelper.authUser._id.toString();
    accessToken.identity = userId;

    // Grant access to Video
    var grant = new VideoGrant();
    // grant.room = 'cool-room';
    accessToken.addGrant(grant);

    // Serialize the token as a JWT
    var jwt = accessToken.toJwt();

    return {
        userId: userId,
        token: jwt,
    }
}