// =================================================
// * imports
// =================================================
const { now, normalize, sendEmail } = require('./utils');
const fs = require('fs');
const config = require("./config.json")
// =================================================
// * Crawler configuration
// =================================================
const URL = "https://egov.potsdam.de/tnv/?START_OFFICE=buergerservice"
const ONE_SECOND = 1000

const mailOptions = {
    from: config.userEmail,
    to: config.targetEmail,
    subject: "",
    html: "Empty"
}
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
const availableTimesSelector = "#ekolcalendarpopopwithtimes select"
const acceptTimeSelector = "#ekolcalendarpopupdayauswahlbuttoncontainer button"

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
    page.setDefaultNavigationTimeout(ONE_SECOND * 60 * 5);//5 minutes
    page.setDefaultNavigationTimeout(ONE_SECOND * 60 * 5);//5 minutes
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
    let freeDates = []
    while (!stop) {
        console.log(`* Current sesion url: ${page.url()} - ${now()}`)
        try {
            const cellsText = await page.evaluate((cellsSelector) => {
                const cells = document.querySelectorAll(cellsSelector)
                return Array.from(cells).map(cell => cell.innerText.trim())
            }, cellsSelector)
            freeDates = cellsText.filter(cellText => !cellText.match(termsToAvoid))
            if (freeDates.length > 0) {
                console.log(`* Found ${freeDates.length} free dates`)
                console.log(freeDates)
                stop = true
                console.log(`* Saving the content of the page`)
                fs.writeFileSync(`./content_${normalize(now())}.html`, await page.content())
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
    console.log(`* Cliking on the first free date`)
    let freeDate = freeDates[0]
    await page.locator(`text=${freeDate}`).click()
    await page.waitForTimeout(ONE_SECOND * 2)
    fs.writeFileSync(`freeDate_${normalize(now())}.html`, await page.content())
    //* Making the screenshot for the email
    const screenshotName = "screenshot.png"
    await page.screenshot({ path: `./${screenshotName}` })
    const emailBody = {
        url: page.url(),
        freeDate: freeDate,
    }
    //* Sending the email
    const mailOptions = {
        from: config.userEmail,
        to: config.targetEmail,
        subject: `** Free date found on ${now()} **`,
        html: `<pre>${JSON.stringify(emailBody, null, 2)}</pre>`,
        attachments: [
            {
                filename: screenshotName,
                path: `./${screenshotName}`,
            }
        ]
    };
    await sendEmail(mailOptions)
    //* Getting the first available time
    const firstAvailableTime = await page.evaluate((selector) => {
        const select = document.querySelector(selector)
        return {
            value: select.options[1].value,
            time: select.options[1].innerText.trim()
        }
    }, availableTimesSelector)
    console.log(`* Selecting the appointment at ${firstAvailableTime.time}`)
    await page.selectOption(availableTimesSelector, firstAvailableTime.value.toString())
    await page.click(acceptTimeSelector)
    await page.waitForTimeout(ONE_SECOND * 2)
    fs.writeFileSync(`selectedTime_${normalize(now())}.html`, await page.content())
    //* done, continue with the other images from the convo and keep doing step by step
    await handleClose(`* Closing the browser`)
})()