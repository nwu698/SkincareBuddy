const { SlashCommandBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("setup")
        .setDescription("Begin setup and choose one feature"),

    async execute(interaction) {
        // build a select menu for features
        const featureMenu = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId("setup_select")
                .setPlaceholder("Select a feature to set up")
                .setMinValues(1) // must pick one
                .setMaxValues(1) // can only pick one
                .addOptions([
                    {
                        label: "RoutineBuddy (Morning)",
                        description: "Sets up reminders for your morning skincare routine",
                        value: "routine_morning",
                    },
                    {
                        label: "RoutineBuddy (Night)",
                        description: "Sets up reminders for your nighttime skincare routine",
                        value: "routine_night",
                    },
                    {
                        label: "SunscreenBuddy",
                        description: "Sets up reminders for sunscreen application",
                        value: "sunscreen",
                    },
                    {
                        label: "HabitBuddy",
                        description: "Placeholder for future habit tracking feature",
                        value: "habit",
                    },
                ])
        );

        await interaction.reply({
            content: "⚙️ Please select a feature to set up:",
            components: [featureMenu],
        });

    },
};