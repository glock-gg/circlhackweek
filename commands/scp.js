const embedUtils = require("../utils/embedutils.js");
const fileUtils = require("../utils/fileutils.js");
const quests = require('../quests.js');
const questUtils = require('../utils/questutils.js');
const constants = require("../constants.js");
const path = require('path');
const stateMachine = require('../statemachine.js');
const db = require("../db.js");

module.exports = {
    name: "scp",
    aliases: [],
    description: "Download files to local server",
    usage: ["<source_file>", "<source_file> <destination_dir>"],
    showInHelp: true,
    dmOnly: true,
    signedUpOnly: true,
    needsAdmin: true,
    needsConnection: true,
    execute: async (message, args) => {
        const connectedServer = stateMachine.getState(message.author.id, "connectedServer");
        const pathState = stateMachine.getState(message.author.id, "path");

        const user = (await db.userModel.find({ userId: message.author.id }))[0];
        const server = (await db.serverModel.find({ ip: connectedServer }))[0];
        const userServer = (await db.serverModel.find({ ip: user.serverIp }))[0];

        // parse source path
        if (!args[0]) {
            return message.channel.send(embedUtils.sendError("You need to enter the file name"));
        }
        const sourcePathInput = args[0];
        const sourcePath = path.join(pathState, sourcePathInput);
        const sourcePathParts = fileUtils.splitPath(sourcePath);

        // get file
        const sourceFile = fileUtils.explorePath(server.files, sourcePathParts, "files");
        if (sourceFile === false) {
            return message.channel.send(embedUtils.sendError(constants.response_text.invalid_path));
        }
        if (sourceFile.type === "dir") {
            return message.channel.send(embedUtils.sendError(sourceFile.name + constants.response_text.not_file));
        }

        // parse destination path
        let destinationPathInput;
        if (!args[1]) {
            if (sourceFile.name.endsWith(".exe")) {
                destinationPathInput = 'bin';
            } else if (sourceFile.name.endsWith(".sys")) {
                destinationPathInput = 'sys';
            } else {
                destinationPathInput = 'home';
            }
        } else {
            destinationPathInput = args[1];
        }
        const destinationPath = path.join(destinationPathInput);
        const destinationPathParts = fileUtils.splitPath(destinationPath);

        // get destination dir
        const destinationFile = fileUtils.explorePath(userServer.files, destinationPathParts, "files");
        if (destinationFile === false) {
            return message.channel.send(embedUtils.sendError(constants.response_text.invalid_path));
        }
        if (destinationFile.type === "file") {
            return message.channel.send(embedUtils.sendError(destinationFile.name + constants.response_text.not_dir));
        }

        // check duplicate name
        const filteredDestinationFile = destinationFile.contents.filter(file => file.name === sourceFile.name);
        if (filteredDestinationFile.length !== 0) {
            return message.channel.send(embedUtils.sendError("File already exists in destination"));
        }

        // copy source into destination
        const newUserServer = (await db.serverModel.find({ ip: user.serverIp }))[0];
        delete sourceFile.path;
        destinationFile.contents.push(sourceFile);
        const savePath = destinationPathParts.length === 0 ? destinationFile.path : destinationFile.path + ".contents";
        newUserServer.set(savePath, destinationFile.contents);
        delete destinationFile.path;
        await newUserServer.save();

        // If current quest has download condition, finish the quest

        // see if a quest is active
        if (typeof user.activeQuest === "number") {
            if (quests.questList[user.activeQuest].end) {
                const endCondition = quests.questList[user.activeQuest].end.condition;

                if (endCondition && endCondition.type === "download") {
                    if (user.questServerList[endCondition.server] === connectedServer) {
                        return await questUtils.endQuest(user, quests.questList[user.activeQuest], message.channel);
                    }
                }
            }
        }

        // success
        return message.channel.send(embedUtils.sendSuccess(`File copied to ${destinationPath}`));
    }
}
