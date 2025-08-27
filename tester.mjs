import allFunctions from "./library.js"
var testPayload ={
    identifier: "test",
    schoolId: "",
    grade:"01",
    personId:"",
    updateInterval: 14400000,
    startDay: 0,
    endDay: 5,
    showPastDays: false,
    hideTodayAfter: "14:00",
    showBreakfast: true,
    showLunch: true,
    testMode: false,
    testDate: null, // Format: "YYYY-MM-DD"
    filters: {
        breakfast: [],
        lunch: []
    },
    itemTypeFilters: {
        breakfast: [],
        lunch: []
    },
    exactNameFilters: {
        breakfast: [],
        lunch: []
    },
    startsWithFilters: {
        breakfast: [],
        lunch: []
    }
}

const testContext ={}
testContext.sendSocketNotification= function (text,payload) {
    console.log("Recieved Socket notification:" + text + "\n payload:\n" + JSON.stringify(payload) + "\n=====")

}
allFunctions.intialize(testContext)
allFunctions.start();
allFunctions.getMealData(testPayload);
