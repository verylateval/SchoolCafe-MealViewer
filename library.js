const axios = require("axios");
const fs = require("fs");
const path = require("path");


const allFunctions = {
    intialize: function(context) {
        this.sendSocketNotification = context.sendSocketNotification;
    },


    start: function () {
        this.fetchingData = {};
        console.log("Starting node helper for: " + this.name);
    },

    socketNotificationReceived: function (notification, payload) {
        if (notification === "GET_MEAL_DATA") {
            this.getMealData(payload);
        }
    },

    getMealData: async function (payload) {
        const {
            identifier,
            schoolId,
            personId,
            grade,
            filters,
            itemTypeFilters,
            exactNameFilters,
            startsWithFilters,
            startDay,
            endDay,
            showPastDays,
            hideTodayAfter,
            showBreakfast,
            showLunch,
            testMode,
            testDate
        } = payload;

        if (this.fetchingData[identifier]) {
            return;
        }

        this.fetchingData[identifier] = true;
        const dateToFetch = this.getDateRange(startDay, endDay, testMode, testDate);
        console.log(encodeURI(dateToFetch))
        const url = `https://webapis.schoolcafe.com/api/CalendarView/GetDailyMenuitemsByGrade?SchoolId=${schoolId}&ServingDate=${encodeURIComponent(dateToFetch)}&ServingLine=Main&MealType=Lunch&Grade=${grade}&PersonId=${personId}`;
        console.log(`Test mode: ${testMode}, Test date: ${testDate}`);
        console.log(`Requesting data from URL: ${url}`);
        console.log(`Date range: ${dateToFetch} `);

        try {
            const response = await axios.get(url);
            console.log("API Response status:", response.status);
            // this.writeDataToFile(response.data, "rawMealData.json");

            const mealData = this.parseMealData(
                response.data,
                filters,
                itemTypeFilters,
                exactNameFilters,
                startsWithFilters,
                showPastDays,
                hideTodayAfter,
                showBreakfast,
                showLunch,
                testMode,
                testDate
            );
            // this.writeDataToFile(mealData, "parsedMealData.json");

            const schoolLogo = `https://custcdn.SchoolCafe.com/schoollogo/${response.data.physicalLocation?.schoolSettings?.schoolLogo}`;
            const schoolName = response.data.physicalLocation?.name || "School";
            this.sendSocketNotification("MEAL_DATA", {
                identifier: identifier,
                mealData: mealData,
                schoolLogo: schoolLogo,
                schoolName: schoolName,
                hasMenus: mealData.length > 0
            });
        } catch (error) {
            console.error("Error fetching meal data:", error.message);
            if (error.response) {
                console.error("Error response data:", error.response.data);
                console.error("Error response status:", error.response.status);
                console.error("Error response headers:", error.response.headers);
            }
            this.sendSocketNotification("MEAL_DATA", {
                identifier: identifier,
                mealData: [],
                schoolLogo: null,
                schoolName: "Error fetching data",
                hasMenus: false
            });
        } finally {
            this.fetchingData[identifier] = false;
        }
    },

    addDays : function(date, days) {
        const result = new Date(date); // clone to avoid mutation
        result.setDate(result.getDate() + days);
        return result;
    },

    getDateRange: function (startDay, endDay, testMode = false, testDate = null) {
        let today;

        if (testMode && testDate) {
            const [year, month, day] = testDate.split('-').map(Number);
            today = new Date(year, month - 1, day);
            console.log(`Using test date (local timezone): ${today.toLocaleString()}`);
        } else {
            today = new Date();
        }
        let currentDayNumber = today.getDay();
        let dateToFetch = today
        let dateModifier = 0
        if(currentDayNumber>endDay){
            if(dateToFetch.getDay() ===6)
            {
                dateModifier = 2
            }
            if(dateToFetch.getDay() ===0)
            {
                dateModifier = 1
            }
        }
        dateToFetch = this.addDays(today,dateModifier)

        const formatDate = (date) => {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${month}/${day}/${year}`;
        };

        return formatDate(dateToFetch)
    },

    parseMealData: function (jsonData, filters, itemTypeFilters, exactNameFilters, startsWithFilters, showPastDays, hideTodayAfter, showBreakfast, showLunch, testMode = false, testDate = null) {
        const mealData = [];
        const menuSchedules = jsonData.ENTREES;

        let today;
        if (testMode && testDate) {
            const [year, month, day] = testDate.split('-').map(Number);
            today = new Date(year, month - 1, day);
            console.log(`Using test date in parseMealData (local timezone): ${today.toLocaleString()}`);
        } else {
            today = new Date();
        }
        today.setHours(0, 0, 0, 0);

        let hideHour, hideMinute;

        if (hideTodayAfter.toLowerCase() !== "never") {
            [hideHour, hideMinute] = hideTodayAfter.split(':').map(Number);
        }
        menuSchedules
            .filter(schedule => schedule.ServingLine === "Main" && !  schedule.MenuItemDescription.includes("2nd Choice"))
            .forEach(schedule => {
                const date = new Date(schedule.ServingDate);
                date.setHours(0, 0, 0, 0);
                const formattedDate = date.toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'long',
                    day: 'numeric'
                });

                mealData.push({
                    date: formattedDate,
                    breakfast: null,
                    lunch: schedule.MenuItemDescription
                });
            });
        return mealData;
    },

    filterMealItems: function (items, mealType, filters, itemTypeFilters, exactNameFilters, startsWithFilters) {
        return items.filter(item => {
            const mealFilters = filters[mealType] || [];
            const mealItemTypeFilters = itemTypeFilters[mealType] || [];
            const mealExactNameFilters = exactNameFilters[mealType] || [];
            const mealStartsWithFilters = startsWithFilters[mealType] || [];

            // Check if the item name contains any of the filtered words
            const nameFilter = !mealFilters.some(filter =>
                item.item_Name.toLowerCase().includes(filter.toLowerCase())
            );

            // Check if the item type is in the filtered types
            const typeFilter = !mealItemTypeFilters.includes(item.item_Type);

            // Check if the item name exactly matches any of the exact name filters
            const exactNameFilter = !mealExactNameFilters.includes(item.item_Name);

            // Check if the item name starts with any of the starts with filters
            const startsWithFilter = !mealStartsWithFilters.some(filter =>
                item.item_Name.toLowerCase().startsWith(filter.toLowerCase())
            );

            return nameFilter && typeFilter && exactNameFilter && startsWithFilter;
        });
    },

    writeDataToFile: function (data, filename) {
        const filePath = path.join(__dirname, filename);
        fs.writeFile(filePath, JSON.stringify(data, null, 2), (err) => {
            if (err) {
                console.error(`Error writing data to ${filename}:`, err);
            } else {
                console.log(`Data written to file: ${filePath}`);
            }
        });
    }
}

module.exports = allFunctions