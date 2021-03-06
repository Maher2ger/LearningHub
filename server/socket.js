const Recording = require("./models/recording");
const fs = require('fs');

let controlPanelId = null;  //ControlPanel Socket ID: null by default, will get a value, when the control Panel is connected
let isRecording = false;    //is true, when the conrolpanel is recording

//when a socket event starts with 's', it means, it comes from server
//when a socket event starts with 'cp', it means, it comes from control-panel
// when a socket event starts with 'b', it means, it comes from browser client

module.exports = (socket) => {   // when new client connect to the io socket
    //socket.handshake.headers.type: header field, tells us, if the client is a webbrowser or the control panel (python)
    // + socket ID
    console.log(socket.handshake.headers.type + " connected, id: " + socket.id); // show when the client connected

    let recording;  //variable to store recording infos to be sent to db
    //if the client is controlloanel
    if (socket.handshake.headers.type == 'controlpanel') {
        controlPanelId = socket.id;     //store the controlpanel socket ID in the controlPanelId variable
        socket.broadcast.emit("controlpanelConnected", true);   //tell the client, that the controlpanel is connected
        socket.broadcast.emit('S_notification',                     //send notification with more details
            {
                title: "ControlPanel",
                message: "controlpanel connected",
                timestamp: new Date().toTimeString().split(' ')[0],
                color: 'text-success'
            });

    }

    if (controlPanelId) {
        // check iff the contorlpanel is connected, then send state to the client
        socket.emit("controlpanelConnected", true);   //tell the client, that the controlpanel is connected
    }

    //when a client disconnects
    socket.on("disconnect", () => {
        //check if this client is the controlpanel
        if (socket.handshake.headers.type == "controlpanel") {
            controlPanelId = null;  //reset the controlPanelId
            isRecording = false;
            socket.broadcast.emit("controlpanelConnected", false);
            socket.broadcast.emit("isRecording", false);
            socket.broadcast.emit('S_notification',
                {
                    title: "ControlPanel",
                    message: "controlpanel disconnected",
                    timestamp: new Date().toTimeString().split(' ')[0],
                    color: 'text-danger'
                });

        }

        console.log(socket.handshake.headers.type + " with ID +" + socket.id + " logged out!");
    });

    //-------------------------------------------------------------------------------------

    //// -- Controlpanel
    socket.on('B_getSensorsList', () => {
        if (controlPanelId) {   //check, if controlpanel is connected
            socket.broadcast.emit("controlpanelConnected", true);   //tell the client, that the controlpanel is connected
            socket.to(controlPanelId).emit("S_getSensorsList"); // if connected, get the sensors List from controlpanel
            socket.emit('S_notification',
                {
                    title: "Sensorslist",
                    message: "Sensorslist is loaded",
                    timestamp: new Date().toTimeString().split(' ')[0],
                    color: 'text-success'
                });
        } else {
            socket.emit("controlpanelConnected", false)
            socket.emit('S_notification',
                {
                    title: "Sensorslist",
                    message: "Sensorslist cannot be loaded, ControlPanel not connected!",
                    timestamp: new Date().toTimeString().split(' ')[0],
                    color: 'text-warning'
                });
        }
    })

    socket.on('CP_sensorsListData', (data) => {
            //send the sensorslist to the client
            socket.broadcast.emit('S_sensorsListData', data);
        }
    )


    //// -- Browser CLients
    socket.on('B_startRecording', (data) => {
        if (controlPanelId) {  //check iff the control-panel is connected
            socket.to(controlPanelId).emit('S_startRecording', data['sensors']);
            isRecording = true;
            socket.emit('isRecording', true);  //to client
            socket.emit('S_notification',
                {
                    title: "start-recording",
                    message: "recording started",
                    timestamp: new Date().toTimeString().split(' ')[0],
                    color: 'text-success'
                });
            //create a new recording
            recording = {
                id: "###",
                name: data['recordingName'],
                sensors: [],
                comments: data['comments'],
                startTime: new Date(),
                creator: data['creator'],
                endTime: ''
            }

            //add the sensorslist to the recording
            for (let sensor in data['sensors']) {
                if (data['sensors'][sensor]) {
                    recording.sensors.push(sensor)
                }
            }


        } else {
            socket.emit('S_notification',
                {
                    title: "start-recording",
                    message: "start recording is not possible, ControlPanel is not connected!",
                    timestamp: new Date().toTimeString().split(' ')[0],
                    color: "text-warning"
                });
        }
        //we create a new recording instance
        //some values like id, endtime will be recieved after recording is finished

    })

    socket.on('B_stopRecording', () => {
        if (controlPanelId) {
            socket.to(controlPanelId).emit('S_stopRecording');
            isRecording = false;
            socket.emit('isRecording', false);
            socket.emit('S_notification',
                {
                    title: "stop-recording",
                    message: "recording is finished",
                    timestamp: new Date().toTimeString().split(' ')[0],
                    color: 'text-danger'
                });
            recording.endTime = new Date();
            recording.duration = (recording.endTime - recording.startTime) / 1000;

            (() => {   //this function to save the recording to the database
                const newRecording = new Recording({
                    name: recording.name,
                    comments: recording.comments,
                    startTime: recording.startTime,
                    endTime: recording.endTime,
                    creator: recording.creator.replaceAll('"', ''),
                    sensors: recording.sensors
                });

                newRecording.save()
                    .catch(err => console.log(err));


            })()
            socket.emit('recording', recording);     //send the recording details to the client
        } else {
            socket.emit('S_notification',
                {
                    title: "Stop-Recording",
                    message: "stop recording is not possible, ControlPanel not connected!",
                    timestamp: new Date().toTimeString().split(' ')[0],
                    color: 'text-warning'
                });
        }
        //sample file will be saved on the server after every recording
        fs.writeFile('server/media/recordings/Recording'+ Date.now().toString() +'.txt'
            , '0000001', function(err) {
            if(err) {
                return console.log(err);
            }
        });


    })

    socket.on('getRecordingsDetails', (id) => {
        //search for a recording in db using id, then send it to the client
        Recording.findOne({
            _id: id
        }).then((data) => {
            socket.emit('S_recordingDetails', data);
        }).catch(err => {
            console.log(err);
        })
    })

    socket.on("upload", (file, callback) => {
        console.log('file recieved');
        writeFile("media/recordings/", file, (err) => {
            callback({ message: err ? "failure" : "success" });

        })});


}
