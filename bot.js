let Discord = require("discord.js");
let yamljs = require("yamljs");
let levelup = require('levelup')
let leveldown = require('leveldown')

let process = require("process");
let fs = require("fs");
let os = require("os");

const software = "discord-quoter";
const version = "1.0.0";
const author = "jython234";

function randomInt(low, high) {
    return Math.floor(Math.random() * (high - low) + low)
}

// Default bot.yml contents
const defaultConfig = {
    databaseLocation: "./db",
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
let db = levelup(leveldown(config.databaseLocation));

// Ensure nextId is set in the database
db.get('nextId', function (err, value) {
    if (err) // Not found, set default since new database
        db.put("nextId", "0", (err) => {
            if(err) console.error(err);
        });
});

let client = new Discord.Client();

client.on("ready", () => {
    console.log("Connected to Discord as " + client.user.tag);
});


// https://github.com/AnIdiotsGuide/discordjs-bot-guide/blob/master/coding-guides/raw-events.md
client.on('raw', packet => {
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
});

client.on("messageReactionAdd", (messageReaction, user) => {
    if(messageReaction.emoji.name === config.reactionName) {
        // Quote this message

        // Don't allow quoting ourself
        if(messageReaction.message.member.user.username === config.username) return;

        let name = "\"" + messageReaction.message.member.displayName + "\"";
        db.get('nextId', function (err, value) {
            console.log("Value: " + parseInt(value));
            if (err) {
                messageReaction.message.channel.send("<@" + user.id + ">, failed to quote message: Database I/O error");
                console.error(err);
            } else {
                db.put(value, "**" + name + ":** " + messageReaction.message.cleanContent, (err) => {
                    if(err) {
                        messageReaction.message.channel.send("<@" + user.id + ">, failed to quote message: Database I/O error");
                        console.error(err);
                    } else {
                        db.put("nextId", parseInt(value) + 1, (err) => {
                            if(err) {
                                console.error(err);
                            } else 
                            messageReaction.message.channel.send("<@" + user.id + ">, message quoted with ID " + value);
                        });
                    }
                });
            }
        });
    }
});
  
client.on('message', msg => {
    if (msg.content.startsWith("!")) {
        if(msg.content.startsWith("!info")) {
            msg.reply("I'm running " + software + " v" + version + " by " + author + " on " + os.platform() + " at " + os.hostname());
        } else if(msg.content.startsWith("!addquote")) {
            let exploded = msg.cleanContent.split(" ");
            if(exploded.length < 2) {
                msg.reply("Usage: !getquote [SNOWFLAKE]");
            } else {
                let message = msg.channel.messages.get(exploded[1]);
                if (!message)
                    msg.reply("Invalid Snowflake");
                else {
                    db.get('nextId', function (err, value) {
                        if (err) {
                            msg.reply("failed to quote message: Database I/O error");
                            console.error(err);
                        } else {
                            db.put(value, "**" + message.member.displayName + ":** " + message.cleanContent, (err) => {
                                if(err) {
                                    msg.reply("failed to quote message: Database I/O error");
                                    console.error(err);
                                } else {
                                    db.put("nextId", parseInt(value) + 1, (err) => {
                                        if(err) {
                                            console.error(err);
                                        } else 
                                        msg.reply("message quoted with ID " + value);
                                    });
                                }
                            });
                        }
                    });
                }
            }
        } else if(msg.content.startsWith("!randquote")) {
            db.get("nextId", (err, value) => {
                if (err) {
                    msg.reply("failed to find ID: Database I/O error");
                    console.error(err);
                } else {
                    // randomInt is [inclusive, exclusive)
                    let id = randomInt(0, parseInt(value));
                    console.log(parseInt(value) + " " + id);
                    db.get(id, (err, value) => {
                        if (err) {
                            msg.reply("failed to find message: Database I/O error");
                            console.error(err);
                        } else {
                            msg.channel.send("**[ID: " + id + "]** " + value);
                        }
                    });
                }
            });
        } else if(msg.content.startsWith("!delquote")) {
            let exploded = msg.cleanContent.split(" ");
            if(exploded.length < 2) {
                msg.reply("Usage: !delquote [ID]");
            } else {
                db.del(exploded[1], (err, value) => {
                    if (err) {
                        msg.reply("I couldn't find that quote");
                        console.error(err);
                    } else {
                        msg.reply("Quote " + exploded[1] + " deleted.");
                    }
                });
            }
        } else if(msg.content.startsWith("!getquote")) {
            let exploded = msg.cleanContent.split(" ");
            if(exploded.length < 2) {
                msg.reply("Usage: !getquote [ID]");
            } else {
                db.get(exploded[1], (err, value) => {
                    if (err) {
                        msg.reply("I couldn't find that quote");
                        console.error(err);
                    } else {
                        msg.channel.send("**[ID: " + exploded[1] + "]** " + value);
                    }
                });
            }
        }
    }
});

// Login and connect to Discord
client.login(config.token);