class dataCtrl {
    constructor() {
        this.theData = {
            foto      : "driver.jpeg",
            name      : "Driver Name",
            nopol     : "DE 1234 AM",
            nolambung : "A 124",
            kendaraan : "Pick-up L300"
        };
        this.rx       = 0;
        this.bindElements();
        this.init();
    }
    scannerCtrl(data) {
        this.theData = {
            foto        : (data.foto) ? data.foto : "logo.png",
            name        : (data.name) ? data.name : "Undefined",
            nopol       : (data.nopol) ? data.nopol : "Undefined",
            nolambung   : (data.nolambung) ? data.nolambung : "Undefined",
            kendaraan   : (data.kendaraan) ? data.kendaraan : "Undefined"
        }
        this.writeData()
    }
    writeData(data = this.data) {
        this.fotoOutput.src = "/img/" + data.foto
        this.nameOutput.textContent = data.name
        this.nopolOutput.textContent = data.nopol
        this.nolamOutput.textContent = data.nolambung
        this.kendOutput.textContent = data.kendaraan
    }

    bindElements() {
        this.formGroups     = document.querySelectorAll('.confirm-group');
        this.liters         = document.querySelectorAll(".form-liter");
        this.lanjutkan      = document.querySelector('#lanjutkan');
        this.afterBox       = document.querySelector('#after-box');
        this.formLiter      = document.querySelector('#form-liter');
        this.literClose     = document.querySelector('#liter-close');
        this.liter          = document.querySelector('#liter');
        this.literError     = document.querySelector("#liter-error");
        this.submit         = document.querySelector("#submit");
        this.resent         = document.querySelector("#resent");
        this.lanjutkanText  = document.querySelector("#lanjutkan-text");
        this.loaderBox      = document.querySelector(".loader-box");
        this.loaderText     = document.querySelector(".loader-text");
        this.success        = document.querySelector("#success");
        this.failed         = document.querySelector("#failed");
        this.toReport       = document.querySelector("#to-report");
        this.formReport     = document.querySelector("#form-report");
        this.report         = document.querySelector("#report");
        this.reportNote     = document.querySelector("#report-input");
        this.fotoOutput     = document.querySelector("#foto-output")
        this.nameOutput     = document.querySelector("#name-output")
        this.nopolOutput    = document.querySelector("#nopol-output")
        this.nolamOutput    = document.querySelector("#nolambung-output")
        this.kendOutput     = document.querySelector("#kendaraan-output")
    }

    init() {
        window.addEventListener('DOMContentLoaded', () => this.setupEvents());
    }

    setupEvents() {
        document.querySelector(".liters").onclick = () => this.liter.focus();

        this.formGroups.forEach(form => {
            const sx = form.querySelector('.sx');
            const tx = form.querySelector('.tx');

            sx.onclick = () => this.handleChoice(form, true, sx, tx);
            tx.onclick = () => this.handleChoice(form, false, sx, tx);
        });

        this.lanjutkan.addEventListener("click", () => this.handleLanjutkan());
        this.literClose.addEventListener("click", () => this.toggleLiterForm(false));
        this.liter.addEventListener("keyup", (e) => this.handleLiterInput());

        [this.submit, this.resent].forEach(btn => {
            btn.addEventListener("click", () => this.handleSubmit(btn.id));
        });

        this.toReport.addEventListener("click", () => this.showReportForm());
        this.report.addEventListener("click", () => this.sendReport());
    }

    handleChoice(form, isTrue, sx, tx) {
        form.dataset.value = isTrue ? "true" : "false";
        sx.parentElement.classList.remove("highlight");

        if (isTrue) {
            sx.querySelector('i').classList.add('clr-green', 'br-green');
            sx.classList.add('active');
            sx.classList.remove('inactive');
            tx.classList.add('inactive');
            tx.classList.remove('active');
        } else {
            tx.querySelector('i').classList.add('clr-orange', 'br-orange');
            tx.classList.add('active');
            tx.classList.remove('inactive');
            sx.classList.add('inactive');
            sx.classList.remove('active');
        }

        this.updateLanjutkanState();
    }

    updateLanjutkanState() {
        let allSelected = Array.from(this.formGroups).every(group => group.dataset.value !== "");
        if (allSelected) {
            this.lanjutkan.classList.remove("cancel");
            this.lanjutkanText.classList.add("dis-none");
        } else {
            this.lanjutkan.classList.add("cancel");
            this.lanjutkanText.classList.remove("dis-none");
        }
    }

    handleLanjutkan() {
        if (this.lanjutkan.classList.contains("cancel")) {
            this.formGroups.forEach(group => {
                if (group.dataset.value === "") group.classList.add("highlight");
            });
            this.lanjutkanText.classList.add("active");
            this.lanjutkanText.textContent = "Pastikan semua pilihan terpilih";
        } else {
            this.afterBox.classList.remove('dis-none');
            this.formLiter.classList.remove('dis-none');
        }
    }

    toggleLiterForm(show) {
        this.afterBox.classList.toggle('dis-none', !show);
        this.formLiter.classList.toggle('dis-none', !show);
    }

    handleLiterInput() {
        if (this.liter.value == 0) this.liter.value = "";
        if (this.liter.value === "") {
            this.literError.textContent = "Masukan angka.";
        } else if (this.liter.value.length >= 1) {
            this.literError.textContent = "Masukan jumlah liter.";
        }
        this.liter.value = this.liter.value.replace(/[^0-9]/g, '');
        if (this.liter.value.length > 3) this.liter.value = this.liter.value.substring(0, 3);
    }

    handleSubmit(buttonId) {
        console.log("click", this.liter.value);
        if (buttonId === "resent") this.rx += 1;
        if (this.rx >= 2) this.toReport.classList.remove("dis-none");
        if (this.liter.value >= 1) {
            this.addTrxData(this.getValue());
        } else {
            this.literError.textContent = "Masukan jumlah liter.";
            this.literError.classList.add("clr-red");
        }
    }

    showReportForm() {
        this.liters.forEach(literx => literx.classList.add("dis-none"));
        this.formReport.classList.remove("dis-none");
    }

    async sendReport() {
        if (this.reportNote.value === "") return;

        this.liters.forEach(literx => literx.classList.add("dis-none"));
        this.loaderBox.classList.remove("dis-none");
        this.updateLoader("Form check", 1000);
        this.updateLoader("Collecting data", 2000);
        this.updateLoader("Sending request", 3000);

        const formated = this.getDateTime();
        await fetch("https://api.fonnte.com/send", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "FRKfzmnGdc9PzVE8Pc_1"
            },
            body: JSON.stringify({
                target: "081354741823",
                message: `Error report : ${formated}\n${this.theData.nolambung} : ${this.reportNote.value}`,
                typing: true
            })
        });
    }

    updateLoader(text, delay) {
        setTimeout(() => {
            this.loaderText.textContent = text;
        }, delay);
    }

    getDateTime() {
        const pad = n => n.toString().padStart(2, '0');
        const now = new Date();
        return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    }

    getValue() {
        return {
            col2: this.getDateTime(),
            col3: (this.konfirmasi().countFalse.length >= 1) ? "false" : "true",
            col4: this.note(),
            col5: document.querySelector("#foto").dataset.value,
            col6: document.querySelector("#nama").dataset.value + " - " + this.theData.name,
            col7: document.querySelector("#nopol").dataset.value + " - " + this.theData.nopol,
            col8: document.querySelector("#nolambung").dataset.value + " - " + this.theData.nolambung,
            col9: document.querySelector("#kendaraan").dataset.value + " - " + this.theData.kendaraan,
            col10: this.liter.value,
            col11: "unknown"
        };
    }

    konfirmasi() {
        let countFalse = [], countTrue = [];
        this.formGroups.forEach(group => {
            if (group.dataset.value === "true") countTrue.push(group.id);
            else countFalse.push(group.id);
        });
        return { countFalse, countTrue };
    }

    note() {
        const { countFalse, countTrue } = this.konfirmasi();
        if (countFalse.length === 0) return "All true";
        if (countTrue.length === 0) return "All false";

        const falseText = countFalse.join(', ');
        const trueText = countTrue.join(', ');
        return `${countTrue.length} True (${trueText}) - ${countFalse.length} False (${falseText})`;
    }

    async addTrxData(data) {
        this.loaderBox.classList.remove("dis-none");
        this.liters.forEach(literx => literx.classList.add("dis-none"));

        this.updateLoader("Form check", 1000);
        this.updateLoader("Collecting data", 2000);
        this.updateLoader("Sending request", 3000);

        const json = await this.myFetch({
            link: "https://script.google.com/macros/s/AKfycbz9N20jtFSIiO2EFWBSUgXnlrjZ4YKmnz-tGIotm6kbTKMF3wRS99pRTCrA1e18KAkZRA/exec",
            data: {
                type: "add-data",
                data: data
            }
        });
        if (!json || !json.confirm) this.afterRespon("#failed");
        else this.afterRespon("#success");
    }

    async myFetch({ link, data }) {
        const proxy = "https://bbmctrl.dlhpambon2025.workers.dev?url=" + encodeURIComponent(link);
        const response = await fetch(proxy, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
        });
        return await response.json();
    }

    afterRespon(selector) {
        this.liters.forEach(literx => literx.classList.add("dis-none"));
        document.querySelector(selector).classList.remove("dis-none");
        this.loaderBox.classList.add("dis-none");
        this.loaderText.textContent = " . . . ";
    }
}
