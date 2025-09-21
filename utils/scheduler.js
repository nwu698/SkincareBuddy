const schedule = require('node-schedule');
const fs = require('fs').promises;
const path = require('path');

class SkincareScheduler {
    constructor(client) {
        this.client = client;
        this.jobs = new Map(); // Store active scheduled jobs
        this.userDataPath = path.join(__dirname, '..', 'userdata.json');
    }

    // Read data
    async readUserData() {
        try {
            const data = await fs.readFile(this.userDataPath, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            console.error('Error reading userdata.json:', error);
            return null;
        }
    }

    // Parse time string to cron format
    parseTimeToSchedule(timeString) {
        if (!timeString) return null;
        try {
            const timeRegex = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i;
            const match = timeString.match(timeRegex);
            
            if (!match) {
                console.error('Invalid time format:', timeString);
                return null;
            }

            let hours = parseInt(match[1]);
            const minutes = parseInt(match[2]);
            const ampm = match[3].toUpperCase();

            // Convert to 24-hour format
            if (ampm === 'PM' && hours !== 12) {
                hours += 12;
            } else if (ampm === 'AM' && hours === 12) {
                hours = 0;
            }

            return { hours, minutes };
        } catch (error) {
            console.error('Error parsing time:', error);
            return null;
        }
    }

    //Create reminder message for skincare routine
    createReminderMessage(routine, timeOfDay) {
        const timeEmoji = timeOfDay === 'morning' ? '🌅' : '🌙';
        const routineText = routine.length > 0 ? routine.join(', ') : 'your skincare routine';
        
        return `${timeEmoji} **${timeOfDay.charAt(0).toUpperCase() + timeOfDay.slice(1)} Skincare Reminder!**\n` +
               `It's time for: **${routineText}**\n` +
               `Don't forget to take care of your skin! 💖`;
    }

    // Schedule morning routine
    async scheduleMorningRoutine(userData) {
        const { morning_reminder, morning } = userData;
        
        if (!morning_reminder || !morning || morning.length === 0) {
            console.log('No morning routine or reminder time set');
            return false;
        }

        const timeSchedule = this.parseTimeToSchedule(morning_reminder);
        if (!timeSchedule) {
            console.error('Failed to parse morning reminder time:', morning_reminder);
            return false;
        }

        const cronPattern = `0 ${timeSchedule.minutes} ${timeSchedule.hours} * * *`;
        const message = this.createReminderMessage(morning, 'morning');

        // Cancel existing morning job if it exists
        if (this.jobs.has('morning')) {
            this.jobs.get('morning').cancel();
        }

        // Schedule new job
        const job = schedule.scheduleJob('morning-routine', cronPattern, () => {
            this.sendReminder(message, 'morning');
        });

        this.jobs.set('morning', job);
        console.log(`Scheduled morning routine for ${morning_reminder} (${cronPattern})`);
        return true;
    }

    // Schedule night routne
    async scheduleNightRoutine(userData) {
        const { night_reminder, night } = userData;
        
        if (!night || night.length === 0) {
            console.log('No night routine set');
            return false;
        }

        // Default to 9:00 PM if no night reminder time is specified
        const reminderTime = night_reminder || '09:00 PM';
        const timeSchedule = this.parseTimeToSchedule(reminderTime);
        
        if (!timeSchedule) {
            console.error('Failed to parse night reminder time:', reminderTime);
            return false;
        }

        const cronPattern = `0 ${timeSchedule.minutes} ${timeSchedule.hours} * * *`;
        const message = this.createReminderMessage(night, 'night');

        // Cancel existing night job if it exists
        if (this.jobs.has('night')) {
            this.jobs.get('night').cancel();
        }

        // Schedule new job
        const job = schedule.scheduleJob('night-routine', cronPattern, () => {
            this.sendReminder(message, 'night');
        });

        this.jobs.set('night', job);
        console.log(`Scheduled night routine for ${reminderTime} (${cronPattern})`);
        return true;
    }

    // Send reminder to appropriate channel
    async sendReminder(message, timeOfDay) {
        try {
            console.log(`[${timeOfDay.toUpperCase()} REMINDER]:`, message);
            
            // Try to get user data to find preferred channel
            const userData = await this.readUserData();
            let channelId = userData?.channelId;
            
            // If no specific channel is set, try to find a general channel
            if (!channelId) {
                // Look for common channel names
                const commonNames = ['general', 'skincare', 'reminders', 'bot'];
                for (const guild of this.client.guilds.cache.values()) {
                    for (const channelName of commonNames) {
                        const channel = guild.channels.cache.find(ch => 
                            ch.name.toLowerCase().includes(channelName) && 
                            ch.isTextBased()
                        );
                        if (channel) {
                            channelId = channel.id;
                            break;
                        }
                    }
                    if (channelId) break;
                }
            }
            
            // Send the message if we found a channel
            if (channelId) {
                const channel = this.client.channels.cache.get(channelId);
                if (channel && channel.isTextBased()) {
                    await channel.send(message);
                    console.log(`Sent ${timeOfDay} reminder to channel: ${channel.name}`);
                } else {
                    console.log(`Channel ${channelId} not found or not text-based`);
                }
            } else {
                console.log('No suitable channel found for sending reminder');
            }
        } catch (error) {
            console.error('Error sending reminder:', error);
        }
    }

    // Initialize
    async initializeSchedules() {
        const userData = await this.readUserData();
        if (!userData) {
            console.log('No user data found, skipping schedule initialization');
            return;
        }

        console.log('Initializing schedules with user data:', userData);

        // Schedule
        await this.scheduleMorningRoutine(userData);
        await this.scheduleNightRoutine(userData);

        console.log(`Active schedules: ${this.jobs.size}`);
    }

    // Update
    async updateSchedules() {
        console.log('Updating schedules...');
        await this.initializeSchedules();
    }

    // Cancel all jobs
    cancelAllJobs() {
        for (const [name, job] of this.jobs) {
            job.cancel();
            console.log(`Cancelled ${name} schedule`);
        }
        this.jobs.clear();
    }

    // Get statuses
    getScheduleStatus() {
        const status = {};
        for (const [name, job] of this.jobs) {
            status[name] = {
                scheduled: true,
                nextInvocation: job.nextInvocation()
            };
        }
        return status;
    }
}

module.exports = SkincareScheduler;