const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageActionRow, MessageButton } = require('discord.js');
const fs = require('fs');
const functions = require('../functions.js');
const Exp = [new RegExp('{'), new RegExp('"', 'g'), new RegExp(':', 'g'), new RegExp(',', 'g'), new RegExp('}', 'g')];
const repl = ['', '', ' : ', ', ', '', ''];

module.exports = {
	data : new SlashCommandBuilder()
		.setName('mod')
		.setDescription('View or remove infractions')
		.addUserOption(User => User
			.setName('user')
			.setDescription('User to find information on')
			.setRequired(true)),

	usage: '[user]',

	async execute(message) {
		const GuildData = JSON.parse(fs.readFileSync('./Server Data/' + message.guild.id + '.json'));
		let target;
		if (functions.liofaPrefixCheck(message)) {
			const args = message.content.split(' ');
			target = { id : functions.userToID(args[1], message), username : functions.userToString(functions.userToID(args[1], message), message) };
		}
		else {
			target = message.options.getUser('user');
		}

		return info(message);

		async function info(interaction) {

			if(GuildData.Watchlist[target.id] != null) {
				const buttons = new MessageActionRow()
					.addComponents(
						new MessageButton()
							.setCustomId('mod reset ' + [target.id]).setLabel('Reset infractions').setStyle('SUCCESS'),
					);
				let timeSinceLastInfraction = functions.minutesSince(Date.now(), GuildData.Watchlist[target.id].time);
				let list = JSON.stringify(GuildData.Watchlist[target.id]);
				for (let x = 0; x < Exp.length; x++) list = list.replace(Exp[x], repl[x]);

				timeSinceLastInfraction = '\n__**Time:**__ \n>\t`' + timeSinceLastInfraction + '` minutes since last infraction';
				const warningCount = '\n__**Warnings:**__ \n>\t`' + GuildData.Watchlist[target.id].warnings + '` warnings';
				interaction.reply({ content : '__**Name:**__ \n>\t' + target.username + timeSinceLastInfraction + warningCount, components : [buttons] });
				return;
			}
			else {
				interaction.reply(target.username + ' has 0 infractions');
			}
		}
	},
	buttons : {
		'reset' : async function reset(interaction, name) {
			const GuildData = JSON.parse(fs.readFileSync('./Server Data/' + interaction.guild.id + '.json'));
			const target = { id : functions.userToID(name[2], interaction), username : functions.userToString(functions.userToID(name[2], interaction), interaction) };
			GuildData.Watchlist[target.id].warnings = 0;
			const message = await interaction.message.fetch();
			message.delete();
			interaction.channel.send(target.username + '\'s infractions have been reset');
			fs.writeFileSync('./Server Data/' + interaction.guild.id + '.json', JSON.stringify(GuildData, null, 2));
			return;
		},
	},
};