// =================================================
// * imports
// =================================================
const { now } = require('./utils');
// =================================================
// * Crawler configuration
// =================================================
const URL = "https://egov.potsdam.de/tnv/?START_OFFICE=buergerservice"
const ONE_SECOND = 1000

// =================================================
// * Selectors
// =================================================
const firstSubmitButtonSelector = "#action_officeselect_termnew_prefix1333626470"
const firstSelectOptSelector = "#id_1333626504"
const secondSelectOptSelector = "#id_1337591238"
const secondSubmitButtonSelector = "#action_concernselect_next"
const cellsSelector = "table .ekolCalendarFreeTimeContainer"
const lastSubmitButtonSelector = "#action_calendarselect_previous"
const retrySubmitSelector = "#action_concerncomments_next"

const termsToAvoid = new RegExp(/0 frei|geschlossen/gi);

(async () => {
    const { chromium } = require('playwright');
    const viewport = {
        width: 1920,
        height: 1080
    }
    const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/61.0.3163.100 Safari/537.36'
    // Start maximized: https://github.com/microsoft/playwright/issues/4046
    const pageConfig = {
        userAgent: userAgent,
        viewport: null,
        acceptDownloads: true
    }

    // Launch browser  & init page
    const headless = process.argv[2] ? JSON.parse(process.argv[2]) : true
    const browser = await chromium.launch({ headless: headless, args: ["--start-maximized"] });
    const context = await browser.newContext(pageConfig);
    const page = await context.newPage();

    //* Handling all the errors
    const handleClose = async (message = "Closing the browser on unexpected Error") => {
        console.log(message);
        const pages = context.pages()
        await Promise.all(pages.map(page => page.close()))
        await browser.close()
        process.exit(0)
    }

    process.on("uncaughtException", async (e) => {
        await handleClose(`Uncaught Exception ${e.message}`)
        process.exit(1)
    })

    process.on("unhandledRejection", async (e) => {
        //e.stack returns the line of the script with the error
        await handleClose(`Request exception: ${e.message} - Line:${e.stack}`)
        process.exit(1)
    })

    //* Going to the URL
    try {
        console.log(`* Going to ${URL}`)
        await page.goto(URL, { waitUntil: "networkidle0" });
        await page.waitForTimeout(ONE_SECOND)
    } catch (error) {
        await handleClose(`!! Error while going to ${URL}`)
    }
    console.log(`* PAGE_URL: ${page.url()}`)
    //* Searching
    await page.click(firstSubmitButtonSelector)
    await page.waitForTimeout(ONE_SECOND)
    console.log(`* Applying the filters to search`)
    await page.selectOption(firstSelectOptSelector, "1")
    await page.waitForTimeout(ONE_SECOND)
    await page.selectOption(secondSelectOptSelector, "1")
    console.log(`* Sending the filters...`)
    await page.waitForTimeout(ONE_SECOND)
    await page.click(secondSubmitButtonSelector)
    await page.waitForTimeout(ONE_SECOND)
    await page.click(retrySubmitSelector)
    await page.waitForTimeout(ONE_SECOND * 2.5)


    //* Checking if there are free dates
    let stop = false
    while (!stop) {
        console.log(`* Current sesion url: ${page.url()} - ${now()}`)
        try {
            const cellsText = await page.evaluate((cellsSelector) => {
                const cells = document.querySelectorAll(cellsSelector)
                return Array.from(cells).map(cell => cell.innerText.trim())
            }, cellsSelector)
            const freeDates = cellsText.filter(cellText => !cellText.match(termsToAvoid))
            if (freeDates.length > 0) {
                console.log(`* Found ${freeDates.length} free dates`)
                console.log(freeDates)
                stop = true
            } else {
                console.log(`* No free dates found, clicking the last submit button`)
                await page.click(lastSubmitButtonSelector)
                await page.waitForTimeout(ONE_SECOND)
                await page.click(retrySubmitSelector)
                await page.waitForTimeout(ONE_SECOND)
            }
        } catch (error) {
            console.log(error)
            await handleClose(`!! Error while checking for free dates`)
        }
        console.log()
    }
    await handleClose(`* Closing the browser`)
})()