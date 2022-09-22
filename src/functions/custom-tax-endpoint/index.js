const { json } = require("body-parser");
const FoxyWebhook = require("../../foxy/FoxyWebhook.js");

/**
 * Receives the request, processes it and sends the response.
 * 
 * @param {Object} requestEvent the request event built by Netlify Functions
 * @returns {Promise<{statusCode: number, body: string}>} the response object
 */
async function handler(requestEvent) {

    const zero_rated_categories = ['Autopilot', 'COFFEE', 'DIFM_COFFEE', 'FR_COFFEE'];

    const taxPayload = JSON.parse(requestEvent.body);
    const country = taxPayload._embedded['fx:shipments'][0]['country'];
    const region = taxPayload._embedded['fx:shipments'][0]['region'];

    let total_amount_taxable = 0;

    // Calculate the total amount of products that are taxable
    for (let i = 0; i < taxPayload._embedded['fx:items'].length; i++) {
        const item = taxPayload._embedded['fx:items'][i];
        
        if (zero_rated_categories.includes(item['_embedded']['fx:item_category']['code']) === false) {
            // This isn't a zero-rated category, so add it's total cost to the total_amount_taxable amount
            total_amount_taxable += item.quantity * item.price;
        }
    }
    // Remove any discounts if there are taxable items (total_discounts is a negative number)
    if (total_amount_taxable > 0) {
        total_amount_taxable += taxPayload.total_discount;
    }
    // Always add shipping to the taxable amount
    total_amount_taxable += taxPayload.total_shipping;

console.log(total_amount_taxable);

    // Default tax object for no taxes
    let calculated_taxes = {
        "ok": true,
        "details": "",
        "name": "",
        "expand_taxes": [
        ],
        "total_amount": 0,
        "total_rate": 0
    };

    if (country == "CA") {
        let GST = 0,
            HST = 0,
            PST = 0,
            QST = 0;
        
        switch (region) {
            case "AB": // Alberta
                GST = 0.05;
                break;
            case "BC": // British Columbia
                GST = 0.05;
                PST = 0.07;
                break;
            case "MB": // Manitoba
                GST = 0.05;
                PST = 0.08;
                break;
            case "NB": // New Brunswick
                HST = 0.15;
                break;
            case "NL": // Newfoundland and Labrador
                HST = 0.15;
                break;
            case "NS": // Nova Scotia
                HST = 0.15;
                break;
            case "NT": // Northwest Territories
                GST = 0.05;
                break;
            case "NU": // Nunavut
                GST = 0.05;
                break;
            case "ON": // Ontario
                HST = 0.13;
                break;
            case "PE": // Prince Edward Island
                HST = 0.15;
                break;
            case "QC": // Quebec
                GST = 0.05;
                QST = 0.09975;
                break;
            case "SK": // Saskatchewan
                GST = 0.05;
                PST = 0.06;
                break;
            case "YT": // Yukon
                GST = 0.05;
                break;
        }

        if (GST + HST > 0) {
            calculated_taxes.name = "Tax"

            if (GST > 0) {
                let tax_amount = format(total_amount_taxable * GST);
                calculated_taxes.expand_taxes.push({
                    "name": "GST",
                    "rate": GST,
                    "amount": tax_amount
                });
                calculated_taxes.total_amount += tax_amount;
                calculated_taxes.total_rate += GST;

                if (PST > 0) {
                    let tax_amount = format(total_amount_taxable * PST);
                    calculated_taxes.expand_taxes.push({
                        "name": "PST",
                        "rate": PST,
                        "amount": tax_amount
                    });
                    calculated_taxes.total_amount += tax_amount;
                    calculated_taxes.total_rate += PST;
                } else if (QST > 0) {
                    let tax_amount = format(total_amount_taxable * QST);
                    calculated_taxes.expand_taxes.push({
                        "name": "QST",
                        "rate": QST,
                        "amount": tax_amount
                    });
                    calculated_taxes.total_amount += tax_amount;
                    calculated_taxes.total_rate += QST;
                }
            } else if (HST > 0) {
                let tax_amount = format(total_amount_taxable * HST);
                calculated_taxes.expand_taxes.push({
                    "name": "HST",
                    "rate": HST,
                    "amount": tax_amount
                });
                calculated_taxes.total_amount += tax_amount;
                calculated_taxes.total_rate += HST;
            }

            calculated_taxes.total_amount = format(calculated_taxes.total_amount);
            calculated_taxes.total_rate = format(calculated_taxes.total_rate, 0, 5);
        }
    }

    console.log(JSON.stringify(calculated_taxes));

    return {
        body: JSON.stringify(calculated_taxes),
        statusCode: 200
    };
}

function format(num, min_decimals = 0, max_decimals = 2) {
    return parseFloat(num.toLocaleString('en-US', {
        minimumFractionDigits: min_decimals,
        maximumFractionDigits: max_decimals,
    }));
}

module.exports = {
    handler
}
