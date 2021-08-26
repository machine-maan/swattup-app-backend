const db = require('../models')
const notifications = require("./notifications")


exports.checkAppVersion = (req, res) => {
  
  const app_version = req.headers["app_version"];
  db.Settings.findOne({},function(err, settings_data){
    if(settings_data.app_version > app_version){
      notifications.send(req.body.deviceToken, "Swattup App Update", "Please update your application with latest version.")
      return res.status(401).json({
        status: false,
        statusCode: 401,
        message: "Please update your application with latest version.",
        responseData: {
          version_using: app_version,
          current_version: settings_data.app_version
        }
      })
    }else{
      return res.status(200).json({
        status: true,
        statusCode: 200,
        message: "Application is upto date."
      })
    }
  }).sort({'_id':-1}).limit(1);

}
