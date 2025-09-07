const { 
    Events, 
    MessageFlags, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle 
} = require('discord.js');
const fs = require("fs");

const filePath = "userdata.json";

// Store user selections in memory (resets if bot restarts, but reloads from JSON if saved)
const routineSelections = new Map(); // key = userId, value = Set of selected items

function buildRoutineButtons(userId) {
    const selected = routineSelections.get(userId) || new Set();

    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId("routine_cleanser")
            .setLabel("Cleanser")
            .setStyle(selected.has("cleanser") ? ButtonStyle.Primary : ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId("routine_retinol")
            .setLabel("Retinol")
            .setStyle(selected.has("retinol") ? ButtonStyle.Primary : ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId("routine_sunscreen")
            .setLabel("Sunscreen")
            .setStyle(selected.has("sunscreen") ? ButtonStyle.Primary : ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId("routine_save")
            .setLabel("💾 Save Routine")
            .setStyle(ButtonStyle.Success),
    );
}

// Load saved routine from userdata.json into memory
function loadRoutineFromFile(userId) {
    if (!fs.existsSync(filePath)) return new Set();

    try {
        const data = fs.readFileSync(filePath, "utf8");
        if (!data) return new Set();

        const json = JSON.parse(data);
        if (json[userId] && Array.isArray(json[userId].routine)) {
            return new Set(json[userId].routine);
        }
    } catch (err) {
        console.error("Error loading userdata.json:", err);
    }

    return new Set();
}

// Save routineSelections[userId] into userdata.json
function saveRoutineToFile(userId, selected) {
    let json = {};

    if (fs.existsSync(filePath)) {
        try {
            const data = fs.readFileSync(filePath, "utf8");
            if (data) {
                json = JSON.parse(data);
            }
        } catch (err) {
            console.error("Error parsing userdata.json:", err);
        }
    }

    json[userId] = {
        routine: Array.from(selected),
    };

    fs.writeFile(filePath, JSON.stringify(json, null, 2), (err) => {
        if (err) console.error("Error writing userdata.json:", err);
    });
}

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        // Handle dropdown → show routine setup
        if (interaction.isStringSelectMenu()) {
            if (interaction.customId === "setup_select") {
                const selected = interaction.values[0]; // single selection

                if (selected === "routine") {
                    // Load from file if not in memory
                    if (!routineSelections.has(interaction.user.id)) {
                        routineSelections.set(interaction.user.id, loadRoutineFromFile(interaction.user.id));
                    }

                    await interaction.update({
                        content: `✅ You selected: **${selected}**\n☀️ Toggle your morning skincare routine steps, then click **Save Routine**:`,
                        components: [buildRoutineButtons(interaction.user.id)],
                    });
                }
            }
        }

        // Handle button clicks
        if (interaction.isButton() && interaction.customId.startsWith("routine_")) {
            const userId = interaction.user.id;

            if (!routineSelections.has(userId)) {
                routineSelections.set(userId, loadRoutineFromFile(userId));
            }

            const selected = routineSelections.get(userId);

            if (interaction.customId === "routine_save") {
                saveRoutineToFile(userId, selected);

                await interaction.reply({
                    content: "✅ Your skincare routine has been saved!",
                    ephemeral: true,
                });
            } else {
                // Toggle selected button
                const choice = interaction.customId.replace("routine_", "");

                if (selected.has(choice)) {
                    selected.delete(choice);
                } else {
                    selected.add(choice);
                }

                await interaction.update({
                    content: "☀️ Toggle your morning skincare routine steps, then click **Save Routine**:",
                    components: [buildRoutineButtons(userId)],
                });
            }
        }

        // Handle slash commands
        if (!interaction.isChatInputCommand()) return;
        console.log(`➡️ Received command: ${interaction.commandName}`);
        const command = interaction.client.commands.get(interaction.commandName);

        if (!command) {
            console.error(`No command matching ${interaction.commandName} was found.`);
            return;
        }

        try {
            await command.execute(interaction);
        } catch (error) {
            console.error(error);
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: 'There was an error while executing this command!', flags: MessageFlags.Ephemeral });
            } else {
                await interaction.reply({ content: 'There was an error while executing this command!', flags: MessageFlags.Ephemeral });
            }
        }
    },
};