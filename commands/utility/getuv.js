const { SlashCommandBuilder } = require('discord.js');
// const fetch = require('node-fetch');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
module.exports = {
	data: new SlashCommandBuilder()
		.setName('getuv')
		.setDescription('Gets current UV index for a ZIP code')
		.addStringOption(option =>
			option
				.setName('zip')
				.setDescription('ZIP code (e.g. 10001)')
				.setRequired(true),
		),

	async execute(interaction) {
		const zip = interaction.options.getString('zip');

		try {
			const response = await fetch(
				`https://data.epa.gov/efservice/getEnvirofactsUVHOURLY/ZIP/${zip}/JSON/`
			);
			const data = await response.json();

			if (!data.length) {
				await interaction.reply(`❌ No UV data found for ZIP code **${zip}**.`);
				return;
			}
			
			const now = new Date();

			// Round to nearest hour
			if (now.getMinutes() >= 30) {
				now.setHours(now.getHours() + 1);
			}
			now.setMinutes(0, 0, 0);

			// Format parts
			const options = { month: 'short' };
			const month = now.toLocaleString('en-US', options);
			const day = String(now.getDate()).padStart(2, '0');
			const year = now.getFullYear();

			let hour = now.getHours();
			const ampm = hour >= 12 ? 'PM' : 'AM';
			hour = hour % 12;
			hour = hour ? hour : 12; // convert 0 to 12
			const hourStr = String(hour).padStart(2, '0');

			const targetDateTime = `${month}/${day}/${year} ${hourStr} ${ampm}`;

			// Latest reading is usually last in array
			const record = data.find(entry => entry.DATE_TIME === targetDateTime);
			const uvIndex = record.UV_VALUE;
			const dateTime = `${record.DATE_TIME}`;

			await interaction.reply(
				`☀️ UV Index for **${zip}**:\n**${uvIndex}** (as of ${dateTime} EST)`
			);
		} catch (err) {
			console.error(err);
			await interaction.reply('⚠️ Error fetching UV data. Please try again.');
		}
	},
};