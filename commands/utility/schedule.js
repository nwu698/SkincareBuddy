const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('schedule')
        .setDescription('Manage your skincare routine schedules')
        .addSubcommand(subcommand =>
            subcommand
                .setName('status')
                .setDescription('Show current schedule status')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('refresh')
                .setDescription('Refresh schedules based on current user data')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('channel')
                .setDescription('Set the channel for skincare reminders')
                .addChannelOption(option =>
                    option
                        .setName('channel')
                        .setDescription('The channel to send reminders to')
                        .setRequired(true)
                )
        ),

    async execute(interaction) {
        // Get the scheduler instance from the client
        const scheduler = interaction.client.scheduler;
        
        if (!scheduler) {
            return interaction.reply('❌ Scheduler not initialized. Please try again later.');
        }

        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'status') {
            const status = scheduler.getScheduleStatus();
            
            if (Object.keys(status).length === 0) {
                return interaction.reply('📅 No schedules are currently active. Use `/setup` to configure your routines.');
            }

            let statusMessage = '📅 **Current Schedule Status:**\n\n';
            
            for (const [name, info] of Object.entries(status)) {
                const timeOfDay = name.charAt(0).toUpperCase() + name.slice(1);
                statusMessage += `**${timeOfDay} Routine:**\n`;
                statusMessage += `└ Status: ✅ Scheduled\n`;
                
                if (info.nextInvocation) {
                    const nextTime = info.nextInvocation.toLocaleString();
                    statusMessage += `└ Next reminder: ${nextTime}\n\n`;
                } else {
                    statusMessage += `└ Next reminder: Not available\n\n`;
                }
            }

            return interaction.reply(statusMessage);
        }

        if (subcommand === 'refresh') {
            try {
                await scheduler.updateSchedules();
                const status = scheduler.getScheduleStatus();
                const activeCount = Object.keys(status).length;
                
                return interaction.reply(`✅ Schedules refreshed successfully! ${activeCount} routine(s) scheduled.`);
            } catch (error) {
                console.error('Error refreshing schedules:', error);
                return interaction.reply('❌ Failed to refresh schedules. Please check your user data and try again.');
            }
        }

        if (subcommand === 'channel') {
            const channel = interaction.options.getChannel('channel');
            
            if (!channel.isTextBased()) {
                return interaction.reply('❌ Please select a text channel for reminders.');
            }

            try {
                const fs = require('fs');
                const path = require('path');
                const userDataPath = path.join(__dirname, '..', '..', 'userdata.json');
                
                let userData = {};
                try {
                    const data = fs.readFileSync(userDataPath, 'utf8');
                    userData = JSON.parse(data);
                } catch (err) {
                    // File doesn't exist or is invalid, start with empty object
                }
                
                userData.channelId = channel.id;
                
                fs.writeFileSync(userDataPath, JSON.stringify(userData, null, 2));
                
                return interaction.reply(`✅ Skincare reminders will now be sent to ${channel}!`);
            } catch (error) {
                console.error('Error setting reminder channel:', error);
                return interaction.reply('❌ Failed to set reminder channel. Please try again.');
            }
        }
    },
};