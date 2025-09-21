const { 
    Events, 
    MessageFlags, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle,
	ModalBuilder,
	TextInputBuilder, TextInputStyle
} = require('discord.js');
const fs = require("fs");

const filePath = "userdata.json";

// Store selections in memory
// Just two keys: "morning", "night"
const routineSelections = {
    morning: new Set(),
    night: new Set(),
	skincare_options: new Set(),
};

function buildRoutineButtons(period = "morning") {
    const selected = routineSelections[period] || new Set();
    const rows = [];

    try {
        const data = fs.readFileSync(filePath, "utf8");
        const json = JSON.parse(data);
        const options = json["skincare_options"] || [];

        // Chunk into groups of 5
        for (let i = 0; i < options.length; i += 5) {
            const row = new ActionRowBuilder();
            const chunk = options.slice(i, i + 5);

            for (const opt of chunk) {
                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId(`${period}_${opt}`)
                        .setLabel(opt)
                        .setStyle(selected.has(opt) ? ButtonStyle.Primary : ButtonStyle.Secondary)
                );
            }
            rows.push(row);
        }

        // Add save button row
        const saveRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`${period}_save`)
                .setLabel("💾 Save Options")
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(`${period}_addnew`)
                .setLabel("➕ Add New")
                .setStyle(ButtonStyle.Secondary)
        );
        rows.push(saveRow);
    } catch (err) {
        console.error("Error loading userdata.json:", err);
    }
    return rows;
}

// Load saved routine from file
function loadRoutineFromFile(period) {
    if (!fs.existsSync(filePath)) return new Set();
    try {
        const data = fs.readFileSync(filePath, "utf8");
        if (!data) return new Set();

        const json = JSON.parse(data);
        if (json[period] && Array.isArray(json[period])) {
            return new Set(json[period]);
        }
    } catch (err) {
        console.error("Error loading userdata.json:", err);
    }

    return new Set();
}

// Save routineSelections[period] into file
async function saveRoutineToFile(period, selected, client = null) {
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
	console.log(selected)
    json[period] = Array.from(selected);
    
    return new Promise((resolve, reject) => {
        fs.writeFile(filePath, JSON.stringify(json, null, 2), async (err) => {
            if (err) {
                console.error("Error writing userdata.json:", err);
                reject(err);
            } else {
                // Update schedules when routine data changes
                if (client && client.scheduler) {
                    try {
                        await client.scheduler.updateSchedules();
                    } catch (schedErr) {
                        console.error("Error updating schedules:", schedErr);
                    }
                }
                resolve();
            }
        });
    });
}

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        // Handle dropdown → show routine setup
        if (interaction.isStringSelectMenu()) {
            if (interaction.customId === "setup_select") {
                const selected = interaction.values[0]; // single selection
                if (selected === "routine_morning" || selected === "routine_night") {
					// Load morning/night + skincare options if missing
					const period = selected.split("_")[1]
					if (!routineSelections[period] || routineSelections[period].size === 0) {
						routineSelections[period] = loadRoutineFromFile(period);
					}
					if (!routineSelections["skincare_options"]) {
						routineSelections["skincare_options"] = loadRoutineFromFile("skincare_options");
					}
					await interaction.update({
						content: `✅ You selected: **${selected}**\n Toggle your **${period} routine** steps, then click **Save Options**:`,
						components: buildRoutineButtons(period),
					});
				}
            }
        }

        // Handle button clicks
        if (interaction.isButton()) {
            const [period, action] = interaction.customId.split("_");
            if (!routineSelections[period]) {
                routineSelections[period] = loadRoutineFromFile(period);
            }
            const selected = routineSelections[period];

            if (action === "save") {
                try {
                    await saveRoutineToFile(period, selected, interaction.client);
                } catch (err) {
                    console.error("Error saving routine:", err);
                }
                
				const modal = new ModalBuilder()
					.setCustomId(`reminder_time_${period}`)
					.setTitle(`${period.charAt(0).toUpperCase() + period.slice(1)} Skincare Reminder`)
				const input = new TextInputBuilder()
					.setCustomId("time")
					.setLabel("Reminder time (HH:MM)")
					.setStyle(TextInputStyle.Short)
					.setPlaceholder("e.g. 08:00 AM")
					.setRequired(true);
				const row = new ActionRowBuilder().addComponents(input);
				modal.addComponents(row);
				await interaction.showModal(modal);

            } else if (action === "addnew"){
				// const newOption = "toner"; // or capture from user input later
				const modal = new ModalBuilder()
					.setCustomId(`addnew_modal_${period}`)
					.setTitle("Add a New Skincare Step");
				const input = new TextInputBuilder()
					.setCustomId("new_option")
					.setLabel("Enter skincare steps (e.g. toner, lip mask")
					.setStyle(TextInputStyle.Paragraph)
					.setRequired(true);
				const row = new ActionRowBuilder().addComponents(input);
				modal.addComponents(row);

				await interaction.showModal(modal);
			} else {
                // Toggle step
                if (selected.has(action)) {
                    selected.delete(action);
                } else {
                    selected.add(action);
                }

                await interaction.update({
                    content: `☀️ Toggle your **${period} routine** steps, then click **Save Routine**:`,
                    components: buildRoutineButtons(period),
                });
            }
        }

		// Handle modal
		if (interaction.isModalSubmit() && interaction.customId.startsWith("addnew_modal_")) {
			const period = interaction.customId.replace("addnew_modal_", "");

			// Split comma-separated values
			const rawInput = interaction.fields.getTextInputValue("new_option");
			const newOptions = rawInput
				.toLowerCase()
				.split(",")                // split by comma
				.map(opt => opt.trim())    // remove spaces
				.filter(opt => opt.length > 0); // ignore empty

			try {
				// Load file
				const data = fs.readFileSync(filePath, "utf8");
				const json = JSON.parse(data);

				if (!Array.isArray(json.skincare_options)) {
					json.skincare_options = [];
				}

				let added = [];
				for (const opt of newOptions) {
					if (!json.skincare_options.includes(opt)) {
						json.skincare_options.push(opt);
						added.push(opt);
					}
				}

				fs.writeFileSync(filePath, JSON.stringify(json, null, 2));

				if (added.length > 0) {
					await interaction.reply({
						content: `✅ Added new options: **${added.join(", ")}**`,
						ephemeral: true,
					});
				} else {
					await interaction.reply({
						content: `⚠️ No new options were added (they may already exist).`,
						ephemeral: true,
					});
				}

				// Refresh buttons so new options appear immediately
				await interaction.followUp({
					content: `☀️ Toggle your **${period} routine** steps, then click **Save Routine**:`,
					components: buildRoutineButtons(period),
				});

			} catch (err) {
				console.error("Error saving new skincare option:", err);
				await interaction.reply({ content: "⚠️ Failed to add new option.", ephemeral: true });
			}
		}

		// Handle input times 
		if (interaction.isModalSubmit() && interaction.customId.startsWith("reminder_time_")) {
			const period = interaction.customId.replace("reminder_time_", "");
			const data = fs.readFileSync(filePath, "utf8");
			const json = JSON.parse(data);
			
			try{
				if (period === "morning"){
					json.morning_reminder = interaction.fields.getTextInputValue("time")
				} else {
					json.night_reminder = interaction.fields.getTextInputValue("time")
				}
				fs.writeFileSync(filePath, JSON.stringify(json, null, 2));
				
				// Update schedules when user data changes
				if (interaction.client.scheduler) {
					await interaction.client.scheduler.updateSchedules();
				}
				
				await interaction.reply(`✅ Successfully saved ${period} reminder time and updated schedules!`)
			} catch (err) {
				console.error("Error saving reminder time:", err);
				await interaction.reply("❌ Error saving reminder time")
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
