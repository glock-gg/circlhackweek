const utils = require("../utils.js");
const db = require("../db.js");
const stateMachine = require('../statemachine.js');
const constants = require('../constants.js');

module.exports = {
    name: "connect",
    aliases: [],
    dmOnly: true,
    signedUpOnly: true,
    needsConnection: false,
    execute: async (message, args) => {
        if (args.length != 1) {
            return message.channel.send(utils.sendError("Please enter the IP of the server you would like to connect to!"));
        }

        let ipToFind = args[0];

        // local addresses
        if (args[0] === "127.0.0.1" || args[0] === "localhost") {
            const user = await db.userModel.find({userId: message.author.id});
            ipToFind = user[0].serverIp;
        }
        
        if (!ipToFind.match("[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}")) {
            return message.channel.send(utils.sendError("Please enter a valid IP address!"));
        }

        const foundServers = await db.serverModel.find({ip: ipToFind}); 
        if (foundServers.length === 0) {
            return message.channel.send(utils.sendError(`We could not find the server with the IP: ${ipToFind}!`))
        }
        const server = foundServers[0];

        // set connected state
        stateMachine.setState(message.author.id, "connectedServer", server.ip);
        stateMachine.setState(message.author.id, "path", "/");


        message.channel.send({
            embed: {
                title: "You have successfully connected to the server! Please login using `$login`!",
                fields: [
                    {
                        name: "IP",
                        value: server.ip
                    }
                ],
                color: constants.embed_colors.success
            }
        });
    }
}