let Discord = require("discord.js");
let yamljs = require("yamljs");
let mongodb = require("mongodb");

let dbhelp = require("./db.js");
let eventHandlers = require("./events.js");

let process = require("process");
let fs = require("fs");

function onRawDiscord(client, packet) {
    if (!['MESSAGE_REACTION_ADD', 'MESSAGE_REACTION_REMOVE'].includes(packet.t)) return;

    const channel = client.channels.get(packet.d.channel_id);

    if (channel.messages.has(packet.d.message_id)) return;

    channel.fetchMessage(packet.d.message_id).then(message => {
        const emoji = packet.d.emoji.id ? `${packet.d.emoji.name}:${packet.d.emoji.id}` : packet.d.emoji.name;
        const reaction = message.reactions.get(emoji);
        // Adds the currently reacting user to the reaction's users collection.
        if (reaction) reaction.users.set(packet.d.user_id, client.users.get(packet.d.user_id));
        // Check which type of event it is before emitting
        if (packet.t === 'MESSAGE_REACTION_ADD') {
            client.emit('messageReactionAdd', reaction, client.users.get(packet.d.user_id));
        }
        if (packet.t === 'MESSAGE_REACTION_REMOVE') {
            client.emit('messageReactionRemove', reaction, client.users.get(packet.d.user_id));
        }
    });
}

// Default bot.yml contents
const defaultConfig = {
    dbUrl: "mongodb://localhost:27017",
    dbName: "discordquoter",
    reactionName: "quote",
    username: "my-bot",
    token: ""
};
var config;

// Try to load bot.yml configuration file
try {
    config = yamljs.load("bot.yml");
} catch(e) {
    console.error("Could not load bot.yml, perhaps it doesn't exist? Creating it...");
    fs.writeFileSync("bot.yml", yamljs.stringify(defaultConfig, 4));
    console.error("Configuration file created. Please fill out the fields and then run the bot again.")
    process.exit(1);
}

// Load database
let mongoClient = new mongodb.MongoClient(config.dbUrl);

mongoClient.connect(err => {
    if(err) {
        console.error("Failed to connect to MongoDB server!");
        console.error(err);
        process.exit(1);
    } else {
        let db = mongoClient.db(config.dbName);

        // Load nextId value
        dbhelp.loadNextId(db).then(() => {
            // Connect to discord
            let client = new Discord.Client();

            client.on("ready", () => {
                console.log("Connected to Discord as " + client.user.tag);
            });


            // https://github.com/AnIdiotsGuide/discordjs-bot-guide/blob/master/coding-guides/raw-events.md
            client.on('raw', (packet) => onRawDiscord(client, packet));

            client.on("messageReactionAdd", (messageReaction, user) => eventHandlers.onReactionAdded(config, db, messageReaction, user));

            client.on("messageReactionRemove", (messageReaction, user) => eventHandlers.onReactionRemoved(config, db, messageReaction, user));

            client.on('message', (msg) => eventHandlers.onMessage(db, msg));

            // Login and connect to Discord
            console.log("Connecting...");
            client.login(config.token);
        }).catch((err) => {
            console.error(err);
            process.exit(1);
        });
    }
});