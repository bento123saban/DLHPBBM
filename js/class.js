"use-strict";


class MainController {
    constructor () {
        this.apiURL         = "https://script.google.com/macros/s/AKfycbxeiKcPU2x_l7WWyfEDGeXqcRZfTb7kXY9rpk_c5K3BlG45HNLyY_Ym_AuLNXRfC-2Bag/exec";
        this.proxyURL       = "https://bbmctrl.dlhpambon2025.workers.dev?url=" + encodeURIComponent(this.apiURL);
        this.qrScanner      = new QRScanner(this);
        this.codeHandler    = new CodeHandler(this);
        this.dataCtrl       = new dataCtrl(this);
    }
    async init() {
        window.addEventListener("DOMContentLoaded", async () => {
            await this.start();
            this.pageNav()
            this.toggleLoader(false, "Connect to server");
        });
    }
    async start() {
        this.toggleLoader(true, "Connect to server");

        setInterval(async () => {
            const start = performance.now();
            try {
                await fetch(this.apiURL, { method: "POST", body: "tesPing" });
                const latency = Math.round(performance.now() - start);
                [...document.querySelectorAll('.ping-text')].forEach(ping => ping.textContent = `${latency} ms`)
            } catch {
                console.warn("Ping failed. Reloading...");
                window.location.reload();
            }
        }, 1000);
    }
    async post(data) {
        try {
            const response = await fetch(this.proxyURL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data)
            });
            return await response.json();
        } catch (e) {
            console.error("Fetch Error:", e);
            return null;
        }
    }
    toggleLoader(show, text = "") {
        const loaderBox     = document.querySelector("#loader");
        const loaderText    = document.querySelector(".loader-text");
        loaderText.textContent = text;
        loaderBox.classList.toggle("dis-none", !show);
    }
    showPage(elm) {
        document.querySelectorAll(".content").forEach(el => el.classList.add("dis-none"));
        document.querySelector(elm).classList.remove("dis-none");
    }
    pageNav(){
        document.querySelectorAll(".to-content-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                const target = btn.dataset.target
                if(target == "#scan") {
                    this.toggleLoader(true, "Scanner configure")
                    this.qrScanner.run()
                } else if (target == "#code") {
                    this.toggleLoader(true, "CodeInputer Configure")
                    this.codeHandler.run()
                } else if (target == '#home') {
                    console.log("home")
                    this.showPage("#home")
                    this.toggleLoader(false, "...")
                }
            })
        })
    }
}

class QRScanner {
    constructor(main) {
        this.html5QrCode        = new Html5Qrcode("reader");
        this.cameras            = [];
        this.currentCamIndex    = 0;
        this.isScanning         = false;
        this.main               = main
    }
    async initCameras() {
        this.cameras = await Html5Qrcode.getCameras();
        if (this.cameras.length === 0) {
            console.log("Tidak ada kamera ditemukan");
        } else {
            console.log(`${this.cameras.length} kamera ditemukan`);
        }
    }
    async startScanner() {
        if (this.cameras.length === 0) {
            console.log("Tidak ada kamera ditemukan");
            return;
        }
        this.isScanning = true;
        document.getElementById("toggle-btn").classList.add("active");

        await this.html5QrCode.start(
            { deviceId: { exact: this.cameras[this.currentCamIndex].id } },
            { fps: 60, qrbox: { width: 350, height: 500 } },
            (decodedText) => {
                document.getElementById("result").innerText = `Hasil: ${decodedText}`;
                this.encodeCheck(decodedText)
            },
            (error) => {
                //console.log(error);
            }
        );
    }
    async stopScanner() {
        this.isScanning = false;
        document.getElementById("toggle-btn").classList.remove("active");
        await this.html5QrCode.stop();
        this.html5QrCode.clear();
    }
    async cekKameraTersedia() {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const kameraAda = devices.some(device => device.kind === 'videoinput');
            if (kameraAda) {
                console.log('Kamera terdeteksi.');
                return { status: true, state: 'detected', msg: 'Kamera terdeteksi.' };
            } else {
                console.warn('Tidak ada kamera terdeteksi di perangkat ini');
                return { status: false, state: 'not detected', msg: 'Tidak ada kamera terdeteksi di perangkat ini' };
            }
        } catch (err) {
            console.error('Gagal mendeteksi perangkat:', err);
            return { status: false, state: "error", msg: 'Gagal mendeteksi perangkat: ' + err };
        }
    }
    async cekIzinKamera() {
        try {
            const status = await navigator.permissions.query({ name: 'camera' });
            console.log('Status izin kamera:', status.state);

            if (status.state === 'granted') {
                return { status: true, state: "granted", msg: "Kamera sudah diizinkan" };
            } else if (status.state === 'prompt') {
                return { status: false, state: "prompt", msg: "Meminta izin kamera..." };
            } else if (status.state === 'denied') {
                return { status: false, state: "denied", msg: "Akses kamera ditolak" };
            } else {
                return { status: false, state: "unsuppot", msg: "Permissions API tidak didukung" };
            }
        } catch (err) {
            console.error('Terjadi error saat cek izin kamera:', err);
            return { status: false, state: "error", msg: "Error cek izin kamera" };
        }
    }
    async permissions() {
        const camAvailable  = await this.cekKameraTersedia(),
            camPermisions   = await this.cekIzinKamera(),
            scanNotif       = document.querySelector("#scan-notif"),
            codeInputBox    = document.querySelector('#scan-code-input'),
            codeInputSpan   = document.querySelector('#scan-code-input span'),
            loaderBox       = document.querySelector('#loader')
   
        if (!camAvailable.status) {
            scanNotif.classList.remove('dis-none')
            codeInputBox.classList.remove('dis-none')
            codeInputBox.querySelector('h4').innerHTML = '<i class="fas fa-circle-excalamtion"></i> ' + camAvailable.msg
            return loaderBox.classList.add('dis-none')
        }
        else if (!camPermisions.status) {
            const camState  = camPermisions.state,
                camMsg        = camPermisions.msg
            
            if (camState == 'prompt') {
                scanNotif.classList.remove('dis-none')
                codeInputBox.classList.remove('dis-none')
                codeInputBox.querySelector('h4').innerHTML = '<i class="fas fa-circle-question"></i> Belum ada akses kamera'
                codeInputSpan.innerHTML = 'Akses kamera belum diberikan.<br>Silahkan ubah di pengaturan browser atau masukan <b class="fz-14">NOMOR LAMBUNG</b> untuk melanjutkan'
            }
            else if (camState == 'denied') {
                scanNotif.classList.remove('dis-none')
                codeInputBox.classList.remove('dis-none')
                codeInputBox.querySelector('h4').innerHTML = '<i class="fas fa-triangle-exclamation"></i> &nbsp;Akses kamera ditolak'
                codeInputSpan.innerHTML = 'Akses kamera ditolak. Silahkan ubah di pengaturan browser untuk memberikan izin kamera atau masukan <i>nomor lambung</i> untuk melanjutkan'
            }
            else if (camState == 'unsuppot') {
                scanNotif.classList.remove('dis-none')
                codeInputBox.classList.remove('dis-none')
                codeInputBox.querySelector('h4').innerHTML = '<i class="fas fa-circle-xmark"></i> ' + camMsg
                codeInputSpan.innerHTML = 'Versi broser ini tidak mendukung penggunaan kamera.<br>Update browser ke versi terbaru atau masukan <b class="fz-14">NOMOR LAMBUNG</b> untuk melanjutkan'
            }
            else {
                scanNotif.classList.remove('dis-none')
                codeInputBox.classList.remove('dis-none')
                codeInputBox.querySelector('h4').innerHTML = '<i class="fas fa-circle-xmark"></i> - ' + camMsg
                codeInputSpan.innerHTML = 'Error : Internal Broser Error. <br>Masukan <b class="fz-14">NOMOR LAMBUNG</b> untuk melanjutkan'
            }
        }

        if (camAvailable.status || camPermisions.status) this.initCameras()
        return true
    }
    bindEvents() {
        document.getElementById("toggle-btn").addEventListener("click", async () => {
            if (this.isScanning) {
                await this.stopScanner();
                this.html5QrCode.clear();
            } else {
                await this.startScanner();
            }
        });

        document.getElementById("switch-camera").addEventListener("click", async () => {
            if (this.cameras.length < 2) return;
            this.currentCamIndex = (this.currentCamIndex + 1) % this.cameras.length;
            if (this.isScanning) {
                await this.stopScanner();
                await this.startScanner();
            }
        });

        document.getElementById("upload-btn").addEventListener("click", () => {
            document.getElementById("file-input").click();
        });

        document.getElementById("file-input").addEventListener("change", (e) => {
            if (e.target.files.length === 0) return alert('not-found');
            this.html5QrCode.scanFile(e.target.files[0], true)
                .then(decodedText => this.encodeCheck(decodedText))
                .catch(() => alert("QR tidak ditemukan pada gambar"));
        });

        window.addEventListener("online", () => console.log("Sekarang ONLINE"));
        window.addEventListener("offline", () => console.log("Sekarang OFFLINE"));
    }
    encodeCheck(encodeText) {
        const params = new URLSearchParams(encodeText);
        if (!params.has("data")) return false;
        try {
            const decoded = atob(params.get("data"));
            const data = JSON.parse(decoded);

            if (data.auth != "DLHP") return false;

            return new dataCtrl().scannerCtrl(data);
        } catch (e) {
            return false;
        }
    }
    async run() {
        await this.permissions()
        this.bindEvents()
        setTimeout(() => this.main.showPage("#scan"), 2000)
    }
    
}

// CodeHandler.js
class CodeHandler {
    constructor(main) {
        this.main       = main;
        this.inputs     = [...document.querySelectorAll(".code-inputer")];
        this.submitBtn  = document.querySelector("#code-submit-button");
        this.bar        = document.querySelector("#code-search-bar");
        this.failed     = document.querySelector("#code-search-failed");
        this.success    = document.querySelector("#code-search-success");
        this.ping       = document.querySelector("#code-search-ping");
    }

    run() {
        this.init();
        setTimeout(() => this.main.showPage("#code"), 2000)
    }

    init() {
        this.inputs.forEach((input, i) => {
            input.addEventListener("input", () => {
                input.value = input.value.replace(/[^a-zA-Z0-9]/g, '');
                if (input.value && i < this.inputs.length - 1) this.inputs[i + 1].focus();
            });
            input.addEventListener("keydown", (e) => {
                // Simpan apakah kita butuh pindah
                input.dataset.moveBack = (e.key === "Backspace" && !input.value && i > 0);
            });
            input.addEventListener("keyup", (e) => {
                this.failed.classList.add("dis-none");
                if (input.dataset.moveBack === "true") {
                    this.inputs[i - 1].focus();
                    input.dataset.moveBack = "false";
                }
            });
        });

        this.submitBtn.onclick = () => {
            if (this.submitBtn.dataset.param === "active") return;
            const code = this.inputs[0].value + "-" + this.inputs[1].value + this.inputs[2].value + this.inputs[3].value ;
            if (code.length < 5) return this.fail("Semua input harus diisi.");
            this.lookup(code.toUpperCase());
        };
    }

    async lookup(code) {
        this.setLoading(true);
        const result = await this.main.post({ type: "getDriver", code : code});

        if (!result) return this.fail("Gagal koneksi.");
        if (!result.confirm) return this.fail(result.status + ": " + result.msg);

        this.success.querySelector("span").textContent = `Data ditemukan: ${result.data.NAMA}`;
        this.success.classList.remove("dis-none");
        this.ping.classList.add("dis-none");
        await new Promise(r => setTimeout(() => this.main.dataCtrl.run(result.data), 1500))
        this.success.classList.add("dis-none");
        this.setLoading(false);
    }

    setLoading(active) {
        this.ping.classList.toggle("dis-none", !active);
        this.bar.classList.toggle("dis-none", !active);
        this.inputs.forEach(input => input.readOnly = active);
        this.submitBtn.dataset.param = active ? "active" : ""
    }

    fail(message) {
        this.setLoading(false);
        this.failed.querySelector("span").textContent = message;
        this.failed.classList.remove("dis-none");
    }
}

class dataCtrl {
    constructor (main) {
        this.main       = main
        this.theData    = {
            name : "-",
            nopol : "-",
            nolambung : "-",
            kendaraan : "-"
        }
        this.rx         = 0;
    }
    run (data) {
        this.main.toggleLoader(true, "Processing data")
        this.theData = data
        this.bindElements()
        this.writeData()
        this.init()
        setTimeout(() => this.main.showPage("#data"), 2500);
    }
    writeData() {
        const data = this.theData
        console.log("datax : " + JSON.stringify(data))
        this.nameOutput.textContent     = data.NAMA
        this.nopolOutput.textContent    = data.NOPOL
        this.nolamOutput.textContent    = data.NOLAMBUNG
        this.kendOutput.textContent     = data.KENDARAAN
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
        this.notif          = document.querySelector(".data-notif")
    }
    init() {
        //document.querySelector(".liters").onclick = () => this.liter.focus();

        this.formGroups.forEach(form => {
            const sx = form.querySelector('.sx');
            const tx = form.querySelector('.tx');

            sx.onclick = () => this.handleChoice(form, true, sx, tx);
            tx.onclick = () => this.handleChoice(form, false, sx, tx);
        });
        
        this.lanjutkan.addEventListener("click", () => this.handleLanjutkan());
        
        
        this.literClose.addEventListener("click", () => this.toggleLiterForm(false));
        this.liter.addEventListener("keyup", (e) => this.handleLiterInput());

        
        //[this.submit, this.resent].forEach(btn => {
            this.submit.addEventListener("click", () => this.handleSubmit());
        //});
        
        /*

        this.toReport.addEventListener("click", () => this.showReportForm());
        this.report.addEventListener("click", () => this.sendReport());*/
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
    toggleLiterForm(show) {
        this.notif.classList.toggle('dis-none', !show);
        this.formLiter.classList.toggle('dis-none', !show);
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
            this.formLiter.classList.remove('dis-none');
            this.notif.classList.remove("dis-none")
        }
    }
    toggleLiterForm(show) {
        this.formLiter.classList.toggle('dis-none', !show)
        this.notif.classList.toggle('dis-none', !show)
    }
    
    showReportForm() {
        this.liters.forEach(literx => literx.classList.add("dis-none"));
        this.formReport.classList.remove("dis-none");
    }
    async sendReport() {
        if (this.reportNote.value === "") return;

        this.liters.forEach(literx => literx.classList.add("dis-none"));
        this.main.
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
            col11: "unknown",
            col12: "",
            col13: "",
            col14: "",
            col15: "",
            col16: "",
            col17: "",
            col18: "",
            col19: "",
            col20: ""
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
        this.main.toggleLoader(false, "")
        this.liters.forEach(literx => literx.classList.add("dis-none"));

        this.updateLoader("Form check", 1000);
        this.updateLoader("Collecting data", 2000);
        this.updateLoader("Sending request", 3000);

        const json = await this.main.post({
            link: this.main.link,
            data: {
                type: "addData",
                data: data
            }
        });
        if (!json || !json.confirm) this.afterRespon("#failed");
        else this.afterRespon("#success");
    }
    afterRespon(selector) {
        this.liters.forEach(literx => literx.classList.add("dis-none"));
        document.querySelector(selector).classList.remove("dis-none");
        this.main.toggleLoader(false)
    }
}