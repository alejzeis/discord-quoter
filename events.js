let dbhelp = require("./db.js");

let os = require("os");

const software = "discord-quoter";
const version = "2.1.1";
const author = "jython234";

function onReactionAdded(config, db, messageReaction, user) {
    if(messageReaction.emoji.name === config.reactionName) {
        // Quote this message

        // Don't allow quoting ourself
        if(messageReaction.message.member.user.username === config.username) return;

        if(messageReaction.count > 1) {
            messageReaction.remove(user);
            return;
        }

        let name = "\"" + messageReaction.message.member.displayName + "\"";
        dbhelp.insertPinnedMessage(db, user.id, messageReaction.message.id, messageReaction.message.author.id, messageReaction.message.member.displayName, messageReaction.message.cleanContent).then((msgId) => {
            messageReaction.message.channel.send("<@" + user.id + ">, message quoted with ID " + msgId);
        }).catch((err) => {
            messageReaction.message.channel.send("<@" + user.id + ">, failed to quote message: Database I/O error");
            console.error("Error while saving a quoted a message!");
            console.error(err);
        });
    }
}

function onReactionRemoved(config, db, messageReaction, user) {
    if(messageReaction.emoji.name === config.reactionName) {
        // try to un-Quote this message

        dbhelp.findQuoteBySnowflake(db, messageReaction.message.id).then((doc) => {
            if(!doc) return;

            if(doc.quoter === user.id) {
                dbhelp.removePinnedMessageBySnowflake(db, messageReaction.message.id).then(() => {
                    messageReaction.message.channel.send("<@" + user.id + ">, deleted quote.");
                }).catch((err) => {
                    console.error("Error while trying to delete quoted message via reaction removal");
                    console.error(err);
                });
            } else {
                // Ignore
                console.log("Ignored.");
            }
        }).catch((err) => {
            console.error("Error while processing reaction removal event:");
            console.error(err);
        });
    }
}

function onMessage(db, msg) {
    if (msg.content.startsWith("!")) {
        if(msg.content.startsWith("!info")) {
            msg.reply("I'm running " + software + " v" + version + " by " + author + " on " + os.platform() + " at " + os.hostname());
        } else if(msg.content.startsWith("!addquote")) {
            let exploded = msg.cleanContent.split(" ");

            if(exploded.length < 2) {
                msg.reply("Usage: !addquote [SNOWFLAKE]");
            } else {
                let message = msg.channel.messages.get(exploded[1]);
                if (!message)
                    msg.reply("Invalid Snowflake");
                else {
                    dbhelp.insertPinnedMessage(db, msg.author.id, message.id, message.author.id, message.member.displayName, message.cleanContent).then((quoteId) => {
                        msg.reply("message quoted with ID " + value);
                    }).catch((err) => {
                        msg.reply("failed to quote message: Database I/O error");
                        console.error("Error while processing !addquote command:");
                        console.error(err);
                    });
                }
            }
        } else if(msg.content.startsWith("!randquote")) {
            dbhelp.findRandomQuoteAny(db).then((doc) => {
                if(doc == null) {
                    msg.channel.send("**Database is empty**");
                } else {
                    msg.channel.send("**[ID: " + doc.quoteId + "]** " + doc.sender + ": " + doc.content);
                }
            }).catch((err) => {
                msg.reply("failed to find a message: Database I/O error");
                console.error("Error while processing !randquote command:");
                console.error(err);
            });
        } else if(msg.content.startsWith("!delquote")) {
            let exploded = msg.cleanContent.split(" ");

            if(exploded.length < 2) {
                msg.reply("Usage: !delquote [ID]");
            } else {
                dbhelp.removePinnedMessage(db, parseInt(exploded[1])).then(() => {
                    msg.reply("Quote " + exploded[1] + " deleted.");
                }).catch((err) => {
                    msg.reply("I couldn't find that quote");
                    console.error("Error while trying to find quote to delete: ");
                    console.error(err);
                });
            }
        } else if(msg.content.startsWith("!getquote")) {
            let exploded = msg.cleanContent.split(" ");

            if(exploded.length < 2) {
                msg.reply("Usage: !getquote [ID]");
            } else {
                dbhelp.findQuoteById(db, parseInt(exploded[1])).then((doc) => {
                    msg.channel.send("**[ID: " + exploded[1] + "]** " + doc.sender + ": " + doc.content);
                }).catch((err) => {
                    msg.reply("I couldn't find that quote");
                    //console.error("Error while processing !getquote command:");
                    //console.error(err);
                });
            }
        }
    }
}

module.exports = {
    onReactionAdded: onReactionAdded,
    onReactionRemoved: onReactionRemoved,
    onMessage: onMessage
};