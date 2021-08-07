// Defines required stuff
require('dotenv').config();
const cld = require('cld');
const Discord = require('discord.js');
const fs = require('fs');

// Discord stuff
const client = new Discord.Client();
client.login(process.env.BOTTOKEN);

// Commands
client.commands = new Discord.Collection();
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
	const command = require(`./commands/${file}`);
	// set a new item in the Collection
	// with the key as the command name and the value as the exported module
	client.commands.set(command.name, command);
}

// Variables
const readSettings = JSON.parse(fs.readFileSync('./Read Only/Settings.json'));
const functions = require('./functions.js');
const LiofaMessages = require('./Read Only/Responses');
const LiofaData = {};
fs.readdirSync('./Server Data/').forEach(file => {
	const name = file.slice(0, -5);
	LiofaData[name] = JSON.parse(fs.readFileSync('./Server Data/' + file));
});

// Defines callbacks
client.on('guildCreate', liofaJoin);
client.on('message', messageRec);

// Start-up confirmation
client.once('ready', () => {
	for (const server in LiofaData) {
		versionCheck(server);
	}
	console.log('Líofa is Talking!');
});

function versionCheck(server) {
	if (LiofaData[server].Version != readSettings.Version) {
		for (const setting in readSettings.Settings) {
			if (typeof LiofaData[server]['Settings'][setting] === 'undefined') {
				LiofaData[server]['Settings'][setting] = readSettings.Settings[setting];
				LiofaData[server].Version = readSettings.Version;
			}
		}
		for (const permission in readSettings.Permissions) {
			if (typeof LiofaData[server]['Permissions'][permission] === 'undefined') {
				LiofaData[server]['Permissions'][permission] = readSettings.Permissions[permission];
				LiofaData[server].Version = readSettings.Version;
			}
		}
		fs.writeFileSync('./Server Data/' + server + '.json', JSON.stringify(LiofaData[server], null, 2));
	}
}

// Run on joining a new server
function liofaJoin(Server) {

	// Creates file for server data
	const FileAddress = './Server Data/' + Server.id + '.json';
	if (fs.existsSync(FileAddress)) {
		return;
	}
	fs.writeFileSync(FileAddress, readSettings);
	LiofaData[Server.id] = JSON.parse(fs.readFileSync(FileAddress));
	console.log('Joined new server ' + Server.id.toString());
}


// Run on every message
async function messageRec(msg) {

	// Checks if Liofa should run on this message
	if (runLiofa(msg) === false) {
		return;
	}

	try {
		// Asks what the language is
		const MessageContent = functions.removeFromString(LiofaData[msg.guild.id].Settings.Whitelist, msg.content);
		const result = await liofaCheck(MessageContent);


		// Gives output if it's not English (or scots or interlingue)
		if (result.code != 'en' && result.code != 'sco' && result.code != 'ie') {

			// Warnings Check
			const warnCount = liofaMod(msg.guild.id, msg.author.id);
			if (warnCount < 3) {

				// Checks if output for given language is available
				if (typeof LiofaMessages[result.code] === 'string') {
					msg.reply('**' + LiofaMessages[result.code] + '** \n `[' + result.name + '] [' + result.percent + '%]`');
				}
				else {
					msg.reply('**Please speak English.** \n `[' + result.name + '] [' + result.percent + '%]`');
					msg.channel.send(result.name + ' must be added to Languages `[' + result.code + ']`');
				}
			}
			else if (warnCount == 3) {
				msg.reply('All further messages will be deleted unless you talk English');
			}
			else if (warnCount > 3) {
				msg.delete();
			}
		}
	}


	// Returns error for when language cannot be detected
	catch (err) {
		return;
	}
}

// Checks if Liofa should run
function runLiofa(msg2) {
	// Checks if it's a Bot
	if (msg2.author.bot === true) {
		return false;
	}
	// Checks if it's a command
	else if (msg2.content.includes('&') && msg2.content.search('&') == 0) {
		const args = msg2.content.slice(1).trim().split(' ');
		const command = args.shift().toLowerCase();

		if (!client.commands.has(command)) return;

		try {
			if (!msg2.member.hasPermission('ADMINISTRATOR') && !msg2.member.roles.cache.some(role => LiofaData[msg2.guild.id]['Permissions'][command].includes(role.id))) {
				msg2.reply(' has insufficient permissions');
				return;
			}
			client.commands.get(command).execute(msg2, args);
			LiofaData[msg2.guild.id] = JSON.parse(fs.readFileSync('./Server Data/' + msg2.guild.id + '.json'));
			return false;
		}
		catch (error) {
			console.error(error);
			msg2.reply('something went wrong');
		}
	}
	// Checks if they have a role from the excluded roles list
	else if (msg2.member.roles.cache.some(ExcludedRole => LiofaData[msg2.guild.id].Permissions.excluded.includes(ExcludedRole.id))) {
		return false;
	}
	return LiofaData[msg2.guild.id].Settings.State;
}


// Check for Language
async function liofaCheck(LiofaMsg) {
	const LiofaResult = await cld.detect(LiofaMsg);
	return LiofaResult.languages[0];
}

// Check Warning Status
function liofaMod(ServerID, UserID) {
	let UserRef = LiofaData[ServerID]['Watchlist'][UserID];

	if (typeof UserRef === 'undefined') {
		UserRef = { warnings : 1, time : Date.now() };
	}

	else if ((Date.now() - UserRef.time) < 1800000) {
		UserRef.warnings++;
		UserRef.time = Date.now();

	}
	else {
		UserRef = { warnings : 1, time : Date.now() };

	}
	LiofaData[ServerID]['Watchlist'][UserID] = UserRef;
	const LiofaUpdate = JSON.stringify(LiofaData[ServerID], null, 2);
	fs.writeFileSync('./Server Data/' + ServerID + '.json', LiofaUpdate);
	console.log(ServerID + '.json updated');
	return UserRef.warnings;
}