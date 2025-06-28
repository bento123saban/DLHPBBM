                                                                                                                
const theData       = {
        foto        : "driver.jpeg",
        name        : "Driver Name",
        nopol       : "DE 1234 AM",
        nolambung   : "A 124",
        kendaraan   : "Pick-up L300"
    },
    formGroups      = document.querySelectorAll('.confirm-group'),
    liters          = document.querySelectorAll(".form-liter"),
    lanjutkan       = document.querySelector('#lanjutkan'),
    afterBox        = document.querySelector('#after-box'),
    formLiter       = document.querySelector('#form-liter'),
    literClose      = document.querySelector('#liter-close'),
    liter           = document.querySelector('#liter'),
    literError      = document.querySelector("#liter-error"),
    submit          = document.querySelector("#submit"),
    resent          = document.querySelector("#resent"),
    lanjutkanText   = document.querySelector("#lanjutkan-text"),
    loaderBox       = document.querySelector(".loader-box"),
    loaderText      = document.querySelector(".loader-text"),
    success         = document.querySelector("#success"),
    failed          = document.querySelector("#failed"),
    toReport        = document.querySelector("#to-report"),
    formReport      = document.querySelector("#form-report"),
    report          = document.querySelector("#report"),
    reportNote      = document.querySelector("#report-input")
    
let rx              = 0

window.addEventListener('DOMContentLoaded', function (e) {
    this.document.querySelector(".liters").onclick = () => liter.focus()
    //loaderBox.classList.add('dis-none')
    formGroups.forEach(form => {
        const sx    = form.querySelector('.sx'),
            tx      = form.querySelector('.tx')
        sx.onclick  = function (e) {
            sx.parentElement.dataset.value = "true"
            sx.parentElement.classList.remove("highlight")
            this.querySelector('i').classList.add('clr-green', 'br-green')
            sx.classList.add('active')
            sx.classList.remove('inactive')
            tx.classList.add('inactive')
            tx.classList.remove('active')
            
            let param = true
            formGroups.forEach(group => (group.dataset.value == "") ? param = false : "")
            if(param) {
                lanjutkan.classList.remove("cancel")
                lanjutkanText.classList.add("dis-none")
            } else {
                lanjutkan.classList.add("cancel")
                lanjutkanText.classList.remove("dis-none")
            }
        }
        tx.onclick  = function (e) {
            tx.parentElement.dataset.value = "false"            
            sx.parentElement.classList.remove("highlight")
            this.querySelector('i').classList.add('clr-orange', 'br-orange')
            tx.classList.add('active')
            tx.classList.remove('inactive')
            sx.classList.add('inactive')
            sx.classList.remove('active')
            
            let param = true
            formGroups.forEach(group => (group.dataset.value == "") ? param = false : "")
            if(param) {
                lanjutkan.classList.remove("cancel")
                lanjutkanText.classList.add("dis-none")
            } else {
                lanjutkan.classList.add("cancel")
                lanjutkanText.classList.remove("dis-none")
            }
        }
    })
    lanjutkan.addEventListener("click", function (e) {
        if(this.classList.contains("cancel")) {
            formGroups.forEach(group => (group.dataset.value == "") ? group.classList.add("highlight") : group.classList.remove("highlight"))
            lanjutkanText.classList.add("active")
            return lanjutkanText.textContent = "Pastikan semua pilihan terpilih"
        }
        afterBox.classList.remove('dis-none')
        formLiter.classList.remove('dis-none')
    })
    literClose.addEventListener("click", function (e) {
        afterBox.classList.add('dis-none')
        formLiter.classList.add('dis-none')
    })
    liter.addEventListener('keyup', function (e) {
        if(this.value == 0) this.value = ""
        if(this.value == "") literError.textContent = "Masukan angka."
        if (this.value.length >= 1) literError.textContent = "Masukan jumlah liter."
        this.value = this.value.replace(/[^0-9]/g, '')
        if (this.value.length > 3) this.value = this.value.substring(0, 3);
    })
    this.document.querySelectorAll("#submit, #resent").forEach(btn => {
        btn.addEventListener("click", () => {
            console.log("click", liter.value)
            if(btn.id == "resent") rx += 1
            if(rx >= 2) toReport.classList.remove("dis-none")
            if(liter.value >= 1) return addTrxData(getValue())
            literError.textContent = "Masukan jumlah liter."
            literError.classList.add("clr-red")
        })
    })
    this.document.querySelectorAll("#scan-lagi, #to-scan").forEach(btn => {

    })
    toReport.addEventListener("click", () => {
        liters.forEach(literx => literx.classList.add("dis-none"))
        formReport.classList.remove("dis-none")
    })
    report.addEventListener("click", async () => {
        if(reportNote.value == "") return
        liters.forEach(literx => literx.classList.add("dis-none"))
        loaderBox.classList.remove("dis-none");
        setTimeout(() => loaderText.textContent = "Form check", 1000);
        setTimeout(() => loaderText.textContent = "Collecting data", 2000);
        setTimeout(() => loaderText.textContent = "Sending request", 3000);
        
        const pad       = n => n.toString().padStart(2, '0'),
            year        = new Date().getFullYear(),
            month       = pad(new Date().getMonth() + 1),
            day         = pad(new Date().getDate()),
            hour        = pad(new Date().getHours()),
            minute      = pad(new Date().getMinutes()),
            second      = pad(new Date().getSeconds()),
            formated    = `${year}-${month}-${day} ${hour}:${minute}:${second}`

        const response = await fetch("https://api.fonnte.com/send", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": "FRKfzmnGdc9PzVE8Pc_1"
                },
                body : JSON.stringify({
                    target: "081354741823",
                    message: `Error report : ${formated}\n${theData.nolambung} : ${reportNote.value}`,
                    typing: true
                })
            });

        const json        = await response.json()
        loaderBox.classList.remove("dis-none");
    })
})

function konfirmasi () {
    let countFalse = [], countTrue = []
    formGroups.forEach(group => (group.dataset.value == "true") ? countTrue.push(group.id) : countFalse.push(group.id))
    return {
        countFalse  : countFalse,
        countTrue   : countTrue
    };
};
function note ()  {
    const result    = konfirmasi(),
        countFalse  = result.countFalse,
        countTrue   = result.countTrue;

    if (countFalse.length == 0) return "All true"
    if (countTrue.length == 0) return "All false"

    const falseText = () => countFalse.map((fls, i) => (i == 0 ? `${fls}` : `, ${fls}`)),
        trueText    = () => countTrue.map((tru, i) => (i == 0 ? `${tru}` : `, ${tru}`));

    return `${countTrue.length} True (${trueText().join('')}) - ${countFalse.length} False (${falseText().join('')})`;
};
function getValue() {
    const pad       = n => n.toString().padStart(2, '0'),
        year        = new Date().getFullYear(),
        month       = pad(new Date().getMonth() + 1),
        day         = pad(new Date().getDate()),
        hour        = pad(new Date().getHours()),
        minute      = pad(new Date().getMinutes()),
        second      = pad(new Date().getSeconds()),
        formated    = `${year}-${month}-${day} ${hour}:${minute}:${second}`;
    
    const foto      = document.querySelector("#foto").dataset.value,
        nama        = document.querySelector("#nama").dataset.value,
        nopol       = document.querySelector("#nopol").dataset.value,
        nolambung   = document.querySelector("#nolambung").dataset.value,
        kendaraan   = document.querySelector("#kendaraan").dataset.value,
        liter       = document.querySelector("#liter").value
        
    return {
        col2     : formated,
        col3     : (konfirmasi().countFalse.length >= 1) ? "false" : "true",
        col4     : note(),
        col5     : foto,
        col6     : nama,
        col7     : nopol,
        col8     : nolambung,
        col9     : kendaraan,
        col10    : liter,
        col11    : "unknown",
        col12    : "",
        col13    : "",
        col14    : "",
        col15    : "",
        col16    : "",
        col17    : "",
        col18    : "",
        col19    : "",
        col20    : ""
    }
}
async function ftch(data) {
    const link  = "https://script.google.com/macros/s/AKfycbz5P2ja4r_-J60WUv0tSMIYiKz71VZLlLAYuihDWvyN3B31yKprtDZW83QagYfGAekCXQ/exec",
        proxy   = "https://bbmctrl.dlhpambon2025.workers.dev?url=" + encodeURIComponent(link);

    const response = await fetch(proxy, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            type: "add-data",
            data: data
        })
    });
    return await response.json();  // ✅ langsung return object, tidak perlu stringify
}
async function addTrxData(data) {
    loaderBox.classList.remove("dis-none");
    liters.forEach(literx => literx.classList.add("dis-none"))

    setTimeout(() => loaderText.textContent = "Form check", 1000);
    setTimeout(() => loaderText.textContent = "Collecting data", 2000);
    setTimeout(() => loaderText.textContent = "Sending request", 3000);

    const link = "https://script.google.com/macros/s/AKfycbz9N20jtFSIiO2EFWBSUgXnlrjZ4YKmnz-tGIotm6kbTKMF3wRS99pRTCrA1e18KAkZRA/exec",
        type    = "add-data"

    const json  = await myFetch({
        link : link,
        data : {
            type : type,
            data : data
        },
        auth : "none"
    })
    if(!json) return afterRespon("#failed")
    if (!json.confirm) return afterRespon("#failed")
    return afterRespon("#success")
}
function afterRespon(elm) {
    liters.forEach(literx => literx.classList.add("dis-none"))
    document.querySelector(elm).classList.remove("dis-none")
    loaderBox.classList.add("dis-none")
    loaderText.textContent = " . . . "
}
async function myFetch(data) {
    const link  = data.link,
        proxy   = "https://bbmctrl.dlhpambon2025.workers.dev?url=" + encodeURIComponent(link);

    const response = await fetch(proxy, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(data.data)
    });
    return await response.json()
}

function getParams() {
    const search    = window.location.search,
        params      = new URLSearchParams(search),
        text        = params.get('data')
    if (!text) return alert('no data found')
}
//getParams()


