// Twilio Video SDK
const { connect, createLocalVideoTrack } = require('twilio-video');

// Configuration
const config = {
    // Replace with your Twilio Account SID
    accountSid: 'AC6a2441f5d1a627b2f2e59fb9edcb9a88',
    // Replace with your Twilio API Key SID
    apiKeySid: 'SKc86154038dba949a9ab99232f07016ad',
    // Replace with your Twilio API Key Secret
    apiKeySecret: 'nA8lFPH6xIqH4MBr6JoHsBcj7QgTMMsp',
    // Replace with your Twilio Video Service SID
    videoServiceSid: 'YOUR_VIDEO_SERVICE_SID'
};

// Generate access token for video calls
async function generateToken(identity, roomName) {
    const AccessToken = require('twilio').jwt.AccessToken;
    const VideoGrant = AccessToken.VideoGrant;

    const accessToken = new AccessToken(
        config.accountSid,
        config.apiKeySid,
        config.apiKeySecret
    );

    accessToken.identity = identity;
    const videoGrant = new VideoGrant({
        room: roomName
    });
    accessToken.addGrant(videoGrant);

    return accessToken.toJwt();
}

// Initialize video call
async function initializeVideoCall(identity, roomName) {
    try {
        const token = await generateToken(identity, roomName);
        const room = await connect(token, {
            name: roomName,
            audio: true,
            video: true
        });

        return room;
    } catch (error) {
        console.error('Error initializing video call:', error);
        throw error;
    }
}

// Initialize voice call
async function initializeVoiceCall(identity, roomName) {
    try {
        const token = await generateToken(identity, roomName);
        const room = await connect(token, {
            name: roomName,
            audio: true,
            video: false
        });

        return room;
    } catch (error) {
        console.error('Error initializing voice call:', error);
        throw error;
    }
}

// Handle local video track
async function setupLocalVideo() {
    try {
        const localVideoTrack = await createLocalVideoTrack();
        return localVideoTrack;
    } catch (error) {
        console.error('Error setting up local video:', error);
        throw error;
    }
}

// Export functions
module.exports = {
    initializeVideoCall,
    initializeVoiceCall,
    setupLocalVideo
}; 