const express = require("express");
const Recording = require('../models/recording');
const router = express.Router();

module.exports = router;

router.post('/addNewRecording', (req, res) => {
    //save new recording to the db
    const newRecording = new Recording( {
        name: req.body.name,
        comments: req.body.comments,
        startTime: req.body.startTime,
        endTime: req.body.endTime,
        creator: req.body.creator.replaceAll('"',''),
        sensors: req.body.sensors
    });

    newRecording.save()
        .then((result)=> {
            res.status(200).json({
                message: 'Recording saved successfully',
                result: result   //return the recording
            })
        }).catch(err => {console.log(err);})

})

router.post("/allRecordings", (req,res)=> {
    Recording.find({
        creator: req.body.creator.replaceAll('"','')
    }).then((result) => {
        res.status(200).json(result);
    })
    })

