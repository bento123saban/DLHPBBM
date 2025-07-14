"use strict";

class MainController {
    constructor() {
        this.state = "";
        this.apiURL = "https://script.google.com/macros/s/AKfycbxi8iJiQCF5kWfrYHCZrSrajfUh6M2kVnWdEFQVrosY7eFkuOpLBUpMr66KfjNBr_rFcg/exec";
        this.proxyURL = `https://bbmctrl.dlhpambon2025.workers.dev?url=${encodeURIComponent(this.apiURL)}`;
        this.qrScanner = new QRScanner(this);
        this.codeHandler = new CodeHandler(this);
        this.dataCtrl = new dataCtrl(this);
        this.pingTimer = null;
    }

    init() {
        window.addEventListener("DOMContentLoaded", async () => {
            //await this.start();
            this.pageNav();
            this.toggleLoader(false, "Connect to server");
        });
    }

    async start() {
        this.toggleLoader(true, "Connect to server");
        // Ping setiap 10 detik, bukan tiap 1 detik
        this.pingTimer = setInterval(async () => {
            const start = performance.now();
            try {
                await fetch(this.apiURL, { method: "POST", body: "tesPing" });
                const latency = Math.round(performance.now() - start);
                document.querySelectorAll(".ping-text").forEach(ping => ping.textContent = `${latency} ms`);
            } catch {
                //console.warn("Ping failed. Reloading...");
                clearInterval(this.pingTimer);
                window.location.reload();
            }
        }, 1000);
    }

    async post(data) {
        const timeoutMs = 10000;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);

        try {
            const response = await fetch(this.proxyURL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
                signal: controller.signal
            });
            clearTimeout(timeout);

            if (!response.ok) {
                let errMsg = `HTTP Error ${response.status}`;
                try {
                    const text = await response.text();
                    if (text && text.length < 1000) errMsg += `: ${text}`;
                } catch (e) {
                    errMsg += ` (gagal baca pesan error: ${e.message})`;
                }
                return { confirm: false, status: "http-error", msg: errMsg };
            }

            const contentLength = response.headers.get("content-length");
            if (contentLength === "0" || !response.body) {
                return { confirm: false, status: "empty-response", msg: "Server mengirim respon kosong." };
            }

            try {
                const json = await response.json();
                if (!json || typeof json !== "object") throw new Error("Bukan object JSON");
                return json;
            } catch (e) {
                return { confirm: false, status: "json-parse-error", msg: "Respon bukan JSON valid: " + e.message };
            }
        } catch (e) {
            clearTimeout(timeout);
            if (e.name === "AbortError") {
                return { confirm: false, status: "timeout", msg: `Request timeout setelah ${timeoutMs / 1000} detik.` };
            }
            return { confirm: false, status: "network-error", msg: "Gagal menghubungi server: " + e.message };
        }
    }

    toggleLoader(show, text = "") {
        const loaderBox = document.querySelector("#loader");
        const loaderText = document.querySelector(".loader-text");
        loaderText.textContent = text;
        loaderBox.classList.toggle("dis-none", !show);
    }

    showPage(elm) {
        document.querySelectorAll(".content").forEach(el => el.classList.add("dis-none"));
        document.querySelector(elm).classList.remove("dis-none");
    }

    pageNav() {
        document.querySelectorAll(".to-content-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                if(btn.classList.contains("off")) return
                const target = btn.dataset.target;
                if (target === "#scan") {
                    this.state = "Scan";
                    this.toggleLoader(true, "Scanner configure");
                    this.qrScanner.run();
                } else if (target === "#code") {
                    this.state = "Code";
                    this.toggleLoader(true, "CodeInputer Configure");
                    this.codeHandler.run();
                } else if (target === "#home") {
                    this.state = "";
                    this.showPage("#home");
                    this.toggleLoader(false, "...");
                }
            });
        });
    }
}

class QRScanner {
    constructor(main) {
        this.main = main;
        this.html5QrCode = new Html5Qrcode("reader");
        this.cameras = [];
        this.currentCamIndex = 0;
        this.isScanning = false;
        this.isBusy = false;
        this.lastPermission = null;
        this.isSwitchingCamera = false;
        this.isTransitioning = false;
        this.isStopping = false;
        this.lastScan = { text: null, time: 0 };
        this._izinInterval = null;
        this.initGLFX();
    }

    async run() {
        this.main.state = "Scan";
        this.main.showPage("#scan");

        await this.initCameras();
        const ok = await this.permissions();
        if (!ok) return;

        this.bindEvents();
        await this.startScanner();

        if (this._izinInterval) clearInterval(this._izinInterval);
        this._izinInterval = setInterval(async () => {
            if (this.main.state !== "Scan") return;
            const izin = await this.cekIzinKamera();
            if (izin.state !== this.lastPermission) {
                this.lastPermission = izin.state;
                await this.permissions();
            }
        }, 1000);
    }

    async stop() {
        await this.stopScanner();
        if (this._izinInterval) {
            clearInterval(this._izinInterval);
            this._izinInterval = null;
        }
    }

    async startScanner() {
        const toggleBtn = document.getElementById("toggle-btn");
        toggleBtn.innerHTML = '<i class="clr-red bolder fas fa-x"></i>'
        if (this.isScanning || this.isTransitioning || this.isStopping) return;

        if (this.cameras.length === 0) await this.initCameras();
        if (this.cameras.length === 0) return;

        this.isTransitioning = true;
        this.isScanning = true;
        toggleBtn?.classList.add("active");

        const config = { fps: 60, qrbox: { width: 300, height: 500 } };

        const onScanSuccess = async (decodedText, result) => {
            const now = Date.now();
            if (decodedText === this.lastScan.text && now - this.lastScan.time < 5000) {
                console.log("[QRScanner] Duplikat QR, abaikan.");
                return;
            }
            this.lastScan = { text: decodedText, time: now };
            const checks = await this.encodeCheck(decodedText);
            if (!checks.status) return;
            await this.main.dataCtrl.run(checks.data);
        };

        try {
            await this.html5QrCode.start(
                { deviceId: { exact: this.cameras[this.currentCamIndex].id } },
                config,
                onScanSuccess
            );
        } catch (err) {
            try {
                await this.safeStop();
                this.html5QrCode = new Html5Qrcode("reader");
                await this.html5QrCode.start({ facingMode: "environment" }, config, onScanSuccess);
            } catch (fallbackErr) {
                console.error("[QRScanner] Start gagal total:", fallbackErr);
                this.isScanning = false;
                this.isTransitioning = false;
            }
        }

        this.isTransitioning = false;
    }

    async stopScanner() {
        document.querySelector('#toggle-btn').innerHTML = '<i class="fas fa-qrcode"></i>'
        if (!this.isScanning || this.isTransitioning || this.isStopping) return;
        this.isStopping = true;
        this.isScanning = false;
        this.isTransitioning = true;
        document.getElementById("toggle-btn")?.classList.remove("active");

        try {
            await this.html5QrCode.stop({ clearScanRegion: true });
            await this.html5QrCode.clear();
        } catch (err) {
            console.warn("[QRScanner] Gagal stop:", err);
        }

        this.isStopping = false;
        this.isTransitioning = false;
    }

    async safeStop() {
        if (this.isScanning) {
            try {
                await this.stopScanner();
            } catch (e) {
                console.warn("[QRScanner] safeStop error:", e);
            }
        }
    }

    async initCameras() {
        try {
            this.cameras = await Html5Qrcode.getCameras();
            const switchBtn = document.getElementById("switch-camera");
            if (switchBtn) {
                console.log('camsLenth : ' + this.cameras.length)
                if (this.cameras.length < 2) switchBtn.classList.add("dis-none");
                else switchBtn.classList.remove("dis-none");
            }
        } catch (e) {
            console.warn("[QRScanner] Init camera error:", e);
        }
    }

    async permissions() {
        const camStatus = await this.cekKameraTersedia();
        const izinStatus = await this.cekIzinKamera();

        const scanHeader = document.querySelector('#scan h4');
        const scanText = document.querySelector('.scan-notif-text');
        const toggleBtn = document.querySelector('#toggle-btn');
        const switchCams = document.querySelector('#switch-camera');
        const codeInput = document.querySelector('#code-input-btn');

        const showErrorUI = (icon, title, message, status = false) => {
            scanHeader.innerHTML = `${icon} ${title}`;
            scanText.innerHTML = message;
            scanText.classList.toggle("dis-none", status);
            scanHeader.classList.toggle("red", !status);
            toggleBtn.classList.toggle("off", !status);
            switchCams.classList.toggle("off", !status);
        };

        if(!camStatus.status || !izinStatus.status) {
            toggleBtn.classList.add("dis-none")
            switchCams.classList.add("dis-none")
            codeInput.classList.remove("dis-none")
            codeInput.classList.add("center")
        }

        if (!camStatus.status) {
            showErrorUI('<i class="fas fa-camera-slash"></i> &nbsp;', camStatus.msg, 'Gunakan perangkat dengan kamera atau input manual &nbsp; <i class="fas fa-code"></i>.');
            codeInput.classList.add("opacity-0", "off");
            return false;
        }

        if (!izinStatus.status) {
            showErrorUI('<i class="fas fa-lock"></i>  &nbsp;', 'Akses kamera ditolak', 'Ubah izin di pengaturan browser atau gunakan input manual &nbsp; <i class="fas fa-code"></i>.');
            return false;
        }

        showErrorUI('', 'QRCode Scanner', '', true);
        document.querySelector('#toggle-btn').innerHTML = '<i class="fas fa-qrcode"></i>'
        toggleBtn.classList.remove("dis-none")
        codeInput.classList.add("dis-none")
        codeInput.classList.remove("center")
        return true;
    }

    async cekKameraTersedia() {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const hasCamera = devices.some(device => device.kind === 'videoinput');
            return hasCamera
                ? { status: true, msg: 'Kamera tersedia' }
                : { status: false, msg: 'Tidak ada kamera ditemukan' };
        } catch (err) {
            return { status: false, msg: 'Error deteksi kamera: ' + err.message };
        }
    }

    async cekIzinKamera() {
        try {
            const status = await navigator.permissions.query({ name: 'camera' });
            return {
                status: status.state === "granted",
                state: status.state,
                msg: status.state
            };
        } catch (err) {
            return { status: false, state: "error", msg: "Gagal cek izin kamera" };
        }
    }

    bindEvents() {
        document.getElementById("toggle-btn")?.addEventListener("click", async () => {
            if (this.isBusy) return;
            if (this.isScanning) await this.stopScanner();
            else await this.startScanner();
        });

        document.getElementById("switch-camera")?.addEventListener("click", async () => {
            if (this.cameras.length < 2) return;
            if (this.isSwitchingCamera) return;

            const btn = document.getElementById("switch-camera");
            this.isSwitchingCamera = true;
            btn?.classList.add("off");

            this.currentCamIndex = (this.currentCamIndex + 1) % this.cameras.length;

            try {
                if (this.isScanning) {
                    await this.stopScanner();
                    await this.startScanner();
                }
            } catch (e) {
                console.warn("[QRScanner] Switch error:", e);
            }

            btn?.classList.remove("off");
            this.isSwitchingCamera = false;
        });

        window.addEventListener("online", () => console.log("[QRScanner] ONLINE"));
        window.addEventListener("offline", () => console.log("[QRScanner] OFFLINE"));
    }

    encodeCheck(base64Str) {
        try {
            const decodedStr = atob(base64Str);
            const json = JSON.parse(decodedStr);
            if (json.auth !== "DLHP" || typeof json.data !== "object") throw new Error("Format QR tidak valid");
            return { status: true, data: json.data };
        } catch (e) {
            return { status: false, message: "Gagal decode: " + e.message };
        }
    }

    initGLFX() {
        if (typeof fx !== 'undefined') {
            this.fxCanvas = fx.canvas();
        } else {
            console.warn("WebGL FX not found. Enhancer mati.");
        }
    }
}

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
        this.main.state = "Code"
        this.init();
        this.clearFormCode()
        setTimeout(() => this.main.showPage("#code"), 2000)
    }
    init() {
        this.inputs.forEach((input, i) => {
            input.addEventListener("input", () => {
                input.value = input.value.replace(/[^a-zA-Z0-9]/g, '');
                if (input.value && i < this.inputs.length - 1) this.inputs[i + 1].focus();
                this.failed.classList.add("dis-none")
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
            this.failed.classList.add("dis-none")
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
    clearFormCode() {
        this.inputs.forEach(input => {
            input.classList.remove("br-red")
            input.classList.add("br-white")
            input.readOnly = false
            input.dataset.moveBack = ""
            input.value = ''
        })
        this.ping.classList.add("dis-none")
        this.failed.classList.add("dis-none")
        this.bar.classList.add("dis-none")
        this.success.classList.add("dis-none")
        this.submitBtn.dataset.param = ""
    }
}

class dataCtrl {
    constructor (main) {
        this.main       = main
        this.theData    = {
            NAMA        : "-",
            NOPOL       : "-",
            NOLAMBUNG   : "-",
            KENDARAAN   : "-"
        }
        this.TRXID      = ""
        this.rx         = 0;
    }
    run (data) {
        console.log("Init DATA")
        this.main.toggleLoader(true, "Processing data")
        this.theData = data
        this.bindElements()
        this.writeData()
        this.init()
        setTimeout(() => this.main.showPage("#data"), 2500);
        console.log(this.theData, data)
    }
    writeData() {
        const data = this.theData
        this.TRXID = Date.now()
        console.log(this.TRXID)
        this.nameOutput.textContent     = data.NAMA
        this.nopolOutput.textContent    = data.NOPOL
        this.nolamOutput.textContent    = data.NOLAMBUNG
        this.kendOutput.textContent     = data.KENDARAAN
        this.fotoOutput.src             = '/img/driver.jpeg'
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

        
        [this.submit, this.resent].forEach(btn => {
            btn.addEventListener("click", () => this.handleSubmit(btn.id));
        });
        
        this.toReport.addEventListener("click", () => this.showReportForm());
        this.report.addEventListener("click", () => this.sendReport());
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
        console.log("liter", this.liter.value);
        if (buttonId == "resent") this.rx += 1;
        if (this.rx >= 1) this.toReport.classList.remove("dis-none");
        if (this.liter.value >= 1) {
            this.addTrxData(this.getValue());
            this.literError.classList.remove("clr-red");
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

        this.main.toggleLoader(true, "Sent report")

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
        this.afterRespon("#report-done")
    }
    getDateTime() {
        const pad = n => n.toString().padStart(2, '0');
        const now = new Date();
        return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    }
    getValue() {
        return [
            this.TRXID,
            this.getDateTime(), // col2
            (this.konfirmasi().countFalse.length >= 1) ? "false" : "true", // col3
            this.note(), // col4
            document.querySelector("#foto").dataset.value, // col5
            document.querySelector("#nama").dataset.value + " - " + this.theData.NAMA, // col6
            document.querySelector("#nopol").dataset.value + " - " + this.theData.NOPOL, // col7
            document.querySelector("#nolambung").dataset.value + " - " + this.theData.NOLAMBUNG, // col8
            document.querySelector("#kendaraan").dataset.value + " - " + this.theData.KENDARAAN, // col9
            this.liter.value, // col10
            "unknown", // col11
            "", // col12
            "", // col13
            "", // col14
            "", // col15
            "", // col16
            "", // col17
            "", // col18
            "", // col19
            ""  // col20
            ];
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
        this.main.toggleLoader(true, "Sending request")
        this.liters.forEach(literx => literx.classList.add("dis-none"));
        let json = await this.main.post({
                type: "addData",
                data: data
            });
        
        console.log(json)
        if (!json) return this.afterRespon("#failed", "Request undefined")
        if(!json.confirm) return this.afterRespon("#failed", json.msg);
        else return this.afterRespon("#success", json.msg);
    }
    clearFormData() {
        if (this.liter) this.liter.value = "";
        this.toReport?.classList.add("dis-none");
        this.notif?.classList.add("dis-none");
        document.querySelectorAll(".form-liter").forEach(form => form.classList.add("dis-none"));
        this.formGroups?.forEach(group => {
            group.dataset.value = "";
            group.classList.remove("highlight");
            group.querySelectorAll("i, .sx, .tx").forEach(el => {
            el.classList.remove(
                "active", "inactive",
                "clr-green", "br-green",
                "clr-blue", "br-blue",
                "clr-red", "br-red",
                "clr-orange", "br-orange"
            );
            });
        });
        this.lanjutkan?.classList.add("cancel");
        this.lanjutkanText?.classList.remove("dis-none");
    }

    afterRespon(selector, text = "") {
        const elm   = document.querySelector(selector),
            span    = elm.querySelector("span");
        span.textContent = (text.length >= 1) ? text : span.textContent
        elm.classList.remove("dis-none");
        this.main.toggleLoader(false)
        if (selector === "#success" || selector === "#report-done") {
            this.formReport.classList.add("dis-none");

            // Teks notifikasi
            const spanText = (selector === "#success")
                ? `Data dengan ID <b>${this.theData.NOLAMBUNG.toUpperCase()}</b> berhasil disimpan`
                : "Terima kasih untuk feedbacknya. <br> Report anda akan segera kami proses.";
            elm.querySelector("span").innerHTML = spanText;

            // Setup tombol ulang
            const scanLagi = elm.querySelector(".scan-lagi");
            const codeLagi = elm.querySelector(".code-lagi");
            const elx = (this.main.state === "Scan") ? scanLagi :
                        (this.main.state === "Code") ? codeLagi : scanLagi;

            let counter = 9;
            const icon = (this.main.state === "Scan") ? "qr" : "";
            elx.innerHTML = `<i class="fas fa-${icon}code br-none"></i> &nbsp; ${this.main.state} (${counter + 1})`;
            elx.classList.remove("grey");
            elx.classList.add("green");

            // Auto countdown + click
            let itv = setInterval(() => {
                elx.innerHTML = `<i class="fas fa-${icon}code br-none"></i> &nbsp; ${this.main.state} (${counter})`;
                if (--counter < 0) {
                    clearInterval(itv);
                    this.clearFormData();
                    elx.click();
                }
            }, 1000);

            // Biar aman dari click berkali-kali
            const stopCountdown = () => {
                clearInterval(itv);
                this.clearFormData();
                scanLagi.removeEventListener("click", stopCountdown);
                codeLagi.removeEventListener("click", stopCountdown);
            };

            scanLagi.addEventListener("click", stopCountdown);
            codeLagi.addEventListener("click", stopCountdown);
        }
    }
}

class ImageCaptureManager {
    constructor() {
        this.video      = document.getElementById("video");
        this.captureBtn = document.getElementById("img-capture");
        this.countBtn   = document.getElementById("img-count");
        this.switchBtn  = document.getElementById("img-cams");
        this.preview    = document.getElementById("the-preview");
        this.previewBox = document.getElementById("img-preview-box");
        this.slideBox   = document.getElementById("img-preview-slide");
        this.clearBtn   = document.getElementById("clear-all");
        this.uploadBtn  = document.getElementById("upload-all");
        this.msgEl      = document.getElementById("img-cam-msg");
        this.prevClose  = document.getElementById("preview-close");

        this.maxImages = 5;
        this.images = [];

        this.devices = [];
        this.currentDeviceIndex = 0;
        this.stream = null;

        this._init();
    }

    async _init() {
        try {
            this.devices = (await navigator.mediaDevices.enumerateDevices())
                .filter(device => device.kind === "videoinput");

            if (!this.devices.length) throw new Error("Tidak ada kamera ditemukan.");

            await this._startCamera(this.devices[this.currentDeviceIndex]?.deviceId);

            this.captureBtn.addEventListener("click", () => this._captureImage());
            this.switchBtn.addEventListener("click", () => this._switchCamera());
            this.countBtn.addEventListener("click", () => this._handleCountBtn());
            this.clearBtn.addEventListener("click", () => this.clearAll());
            this.prevClose.addEventListener("click", () => this._previeWClose());
            this.uploadBtn.addEventListener("click", () => this._handleUpload());

            document.addEventListener("visibilitychange", () =>
                (document.hidden)
                    ? this._stopCamera() : (this.previewBox.classList.contains("dis-none"))
                    ? this._startCamera(this.devices[this.currentDeviceIndex]?.deviceId) : ""
            );
        } catch (err) {
            this._showMessage("Kamera tidak tersedia");
            console.error(err);
        }
    }

  async _startCamera(deviceId) {
    try {
      const constraints = deviceId
        ? { video: { deviceId: { exact: deviceId } }, audio: false }
        : { video: true, audio: false };

      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.video.srcObject = this.stream;

    } catch (err) {
        this._stopCamera();
        console.error("Gagal memulai kamera:", err);

        let message = "Kamera gagal dinyalakan";

        if (err.name === "OverconstrainedError") {
            message = "Kamera tidak ditemukan. Mencoba fallback...";
            console.warn("Fallback ke kamera default");
            try {
                this.stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
                this.video.srcObject = this.stream;
                return;
            } catch (fallbackErr) {
                console.error("Fallback gagal:", fallbackErr);
            }
        }

        if (err.name === "NotAllowedError") {
            message = "Akses kamera ditolak. Harap izinkan dari browser.";
        } else if (err.name === "NotFoundError") {
            message = "Kamera tidak tersedia di perangkat ini.";
        } else if (err.name === "NotReadableError") {
            message = "Kamera sedang dipakai aplikasi lain.";
        }

        this._showMessage(message);
    }
  }

  _stopCamera() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    this.video.srcObject = null;
  }

  _captureImage() {
    if(this.images.length >= 1) this.countBtn.classList.remove("opacity-0", "off");
    else this.countBtn.classList.add("opacity-0", "off");
    if (this.images.length >= this.maxImages) {
      this._showMessage(`Maksimal ${this.maxImages} gambar`);
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = this.video.videoWidth;
    canvas.height = this.video.videoHeight;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(this.video, 0, 0);

    const imgData = canvas.toDataURL("image/webp");
    this.images.push(imgData);

    this._updatePreview();
    this._updateCountBadge();
  }

  _updatePreview() {
    if (!this.images.length) {
      this.previewBox.classList.add("dis-none");
      this.slideBox.innerHTML = "";
      return;
    }

    this.slideBox.innerHTML = "";
    this.images.forEach((src, i) => {
      const img = document.createElement("img");
      img.src = src;
      img.className = "slide-img";
      img.alt = `Gambar ${i+1}`;

      const delBtn = document.createElement("button");
      delBtn.innerHTML = "❌";
      delBtn.className = "delete-btn";
      delBtn.onclick = () => {
        this.images.splice(i, 1);
        this._updatePreview();
        this._updateCountBadge();
      };

      const box = document.createElement("div");
      box.className = "slide-box relative";
      box.appendChild(img);
      box.appendChild(delBtn);
      this.slideBox.appendChild(box);
    });
  }

  _previeWClose() {
    this._startCamera(this.devices[this.currentDeviceIndex]?.deviceId);
    this.previewBox.classList.add("dis-none");
  }

  _updateCountBadge() {
    const count = this.images.length;
    this.countBtn.dataset.count = count || "";
    if (count > 0) this.countBtn.classList.remove("opacity-0", "off");
    else this.countBtn.classList.add("opacity-0", "off")
  }

  async _switchCamera() {
    if (this.devices.length < 2) {
      this._showMessage("Hanya 1 kamera tersedia");
      return;
    }

    this.currentDeviceIndex = (this.currentDeviceIndex + 1) % this.devices.length;
    const nextDeviceId = this.devices[this.currentDeviceIndex]?.deviceId;

    await this._startCamera(nextDeviceId);
  }

  _handleCountBtn() {
    if(this.countBtn.classList.contains("off")) return
    if (!this.images.length) {
      this._showMessage("Belum ada gambar");
      return;
    }

    this._stopCamera();
    this.preview.src = this.images[this.images.length - 1];
    this.previewBox.classList.remove("dis-none");
  }

  _showMessage(text, duration = 10000) {
    this.msgEl.textContent = text;
    this.msgEl.classList.remove("dis-none");

    clearTimeout(this._msgTimeout);
    this._msgTimeout = setTimeout(() => {
      this.msgEl.classList.add("dis-none");
    }, duration);
  }

  _handleUpload() {
    if (!this.images.length) {
      this._showMessage("Tidak ada gambar untuk diupload");
      return;
    }

    this._showMessage("Upload belum diimplementasi");
  }

  getCapturedImages() {
    return this.images;
  }

  clearAll() {
    this.countBtn.classList.add("opacity-0")
    this.countBtn.classList.add("off")
    this.images = [];
    this._updatePreview();
    this._updateCountBadge();
    this._showMessage("Semua gambar dihapus");
  }
}

window.addEventListener("DOMContentLoaded", () => {
  //window.imageManager = new ImageCaptureManager();
});





/*
console.log(btoa(JSON.stringify({
    auth : "DLHP",
    data : {
        NAMA : "Bendhard",
        NOPOL   : "DE 1611 SB",
        NOLAMBUNG : "B-16",
        KENDARAAN : "Lamborginhi"
    }
})));

(() => {
    const result = new QRScanner().encodeCheck(
        "eyJhdXRoIjoiRExIUCIsImRhdGEiOnsiTkFNQSI6IkJlbmRoYXJkIiwiTk9QT0wiOiJERSAxNjExIFNCIiwiTk9MQU1CVU5HIjoiQi0xNiIsIktFTkRBUkFBTiI6IkxhbWJvcmdpbmhpIn19"
    );

    const json = JSON.stringify(result, null, 2);
    console.log(json);
})();



class MainController {
    constructor () {
        this.state          = ""
        this.apiURL         = "https://script.google.com/macros/s/AKfycbxi8iJiQCF5kWfrYHCZrSrajfUh6M2kVnWdEFQVrosY7eFkuOpLBUpMr66KfjNBr_rFcg/exec";
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
        const resp = await fetch("https://quickchart.io/qr?text=eyJhdXRoIjoiRExIUCIsImRhdGEiOnsiTkFNQSI6IkJlbmRoYXJkIiwiTk9QT0wiOiJERSAxNjExIFNCIiwiTk9MQU1CVU5HIjoiQi0xNiIsIktFTkRBUkFBTiI6IkxhbWJvcmdpbmhpIn19&caption=Bend16&margin=6"
        )
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
        const timeoutMs = 10000;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), timeoutMs);

        try {
            const response = await fetch(this.proxyURL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(data),
                signal: controller.signal
            });

            clearTimeout(timeout);

            // ⛔ Error status HTTP (404, 500, dll)
            if (!response.ok) {
                let errMsg = `HTTP Error ${response.status}`;
                try {
                    const text = await response.text();
                    if (text && text.length < 1000) errMsg += `: ${text}`;
                } catch (e) {
                    errMsg += ` (gagal baca pesan error: ${e.message})`;
                }
                return {
                    confirm: false,
                    status: "http-error",
                    msg: errMsg
                };
            }

            // ⚠️ Respon kosong
            const contentLength = response.headers.get("content-length");
            if (contentLength === "0" || !response.body) return {
                confirm: false,
                status: "empty-response",
                msg: "Server mengirim respon kosong."
            };
            
            // 🧩 Coba parse JSON
            let json;
            try {json = await response.json()}
            catch (e) {
                return {
                    confirm: false,
                    status: "json-parse-error",
                    msg: "Respon server bukan JSON valid. " + e.message
                };
            }

            // ❌ Struktur JSON tidak sesuai
            if (!json || typeof json !== "object") return {
                confirm: false,
                status: "invalid-json",
                msg: "Respon server bukan objek JSON yang valid."
            };
            // ✅ Berhasil
            return json;

        } catch (e) {
            clearTimeout(timeout);
            // ⌛ Timeout
            if (e.name === "AbortError") return {
                confirm: false,
                status: "timeout",
                msg: `Request timeout setelah ${timeoutMs / 1000} detik.`
            };

            // 🌐 Fetch error (offline, DNS, SSL, CORS, dll)
            return {
                confirm: false,
                status: "network-error",
                msg: "Gagal menghubungi server: " + e.message
            };
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
                    this.state = "Scan"
                    this.toggleLoader(true, "Scanner configure")
                    this.qrScanner.run()
                } else if (target == "#code") {
                    this.state = "Code"
                    this.toggleLoader(true, "CodeInputer Configure")
                    this.codeHandler.run()
                } else if (target == '#home') {
                    console.log("home")
                    this.state = ""
                    this.showPage("#home")
                    this.toggleLoader(false, "...")
                }
            })
        })
    }
    urlChecker(url) {
        const params = new URLSearchParams(url);
        if (!params.has("code")) return false;

        try {
            const decoded = atob(params.get("data"));
            const data = JSON.parse(decoded);

            if (data.auth != "DLHP") return false;
            this.resetScanner()
            return new dataCtrl().scannerCtrl(data);
        } catch (e) {
            return false;
        }
    }
}
class QRScanner {
    constructor(main) {
        this.main               = main;
        this.html5QrCode        = new Html5Qrcode("reader");
        this.cameras            = [];
        this.currentCamIndex    = 0;
        this.isScanning         = false;
        this.isBusy             = false;
        this.lastPermission     = null;
        this.seenQRCodes        = new Set();
        this.overlayCanvas      = document.getElementById("debug-overlay");
        this.enhanceCanvas      = document.createElement("canvas");
        this.enhanceCanvas.width    = 300;
        this.enhanceCanvas.height   = 500;
        this.isSwitchingCamera      = false;
        this.isScanning         = false;
        this.isStopping         = false;
        this.enhanceCtx         = this.enhanceCanvas.getContext("webgl") || this.enhanceCanvas.getContext("experimental-webgl");
        this.initGLFX();
    }
    async initCameras() {
        try {
            this.cameras = await Html5Qrcode.getCameras();
            console.log(`[QRScanner] Kamera ditemukan: ${this.cameras.length}`);

            const switchBtn = document.getElementById("switch-camera");
            if (switchBtn) {
                if (this.cameras.length < 2) switchBtn.classList.add("off");
                else switchBtn.classList.remove("off");
            }
        } catch (e) {
            console.warn("[QRScanner] Gagal inisialisasi kamera:", e);
        }
    }
    async applyEnhanceFilter(result) {
        try {
            const video = document.querySelector("video");
            if (!video || !this.fxCanvas) return true;

            const tmpCanvas = document.createElement("canvas");
            tmpCanvas.width = video.videoWidth;
            tmpCanvas.height = video.videoHeight;
            const ctx = tmpCanvas.getContext("2d");
            ctx.drawImage(video, 0, 0, tmpCanvas.width, tmpCanvas.height);
            const texture = this.fxCanvas.texture(tmpCanvas);
            this.fxCanvas.draw(texture)
                .brightnessContrast(0.1, 0.2) // boost brightness & contrast
                .unsharpMask(20, 2)            // sharpen
                .update();
            return true;
        } catch (e) {
            console.warn("[Enhancer] Gagal apply filter:", e);
            return true; // tetap lanjut scan meskipun gagal
        }
    }
    async restartScanner() {
        if (!this.isScanning || this.isBusy) return;
        try {
            await this.html5QrCode.stop();
            await this.html5QrCode.clear();
        } catch (e) {
            console.warn("[QRScanner] Restart gagal stop/clear:", e);
        }
        this.html5QrCode = new Html5Qrcode("reader");
        await this.startScanner();
    }
    encodeCheck(base64Str) {
        try {
            const decodedStr = atob(base64Str); // Decode Base64
            const json = JSON.parse(decodedStr); // Parse jadi JSON

            if (json.auth !== "DLHP" || typeof json.data !== "object") throw new Error("Format DLHP tidak valid");
            return {
                status: true,
                message: "QR Valid DLHP",
                data: json.data,
                auth: json.auth
            };
        } catch (e) {
            return {
                status: false,
                message: "Gagal decode DLHP: " + e.message
            };
        }
    }
    async run() {
        this.main.state = "Scan";
        this.main.showPage("#scan");

        await this.initCameras();
        const ok = await this.permissions();
        if (!ok) return;

        this.bindEvents();

        setInterval(async () => {
            if (this.main.state !== "Scan") return;
            const izin = await this.cekIzinKamera();
            if (izin.state !== this.lastPermission) {
                this.lastPermission = izin.state;
                await this.permissions();
            }
        }, 1000);
    }
    async cekIzinKamera() {
        try {
            const status = await navigator.permissions.query({ name: 'camera' });
            switch (status.state) {
                case 'granted': return { status: true,  state: "granted", msg: "Kamera sudah diizinkan" };
                case 'prompt':  return { status: false, state: "prompt", msg: "Meminta izin kamera..." };
                case 'denied':  return { status: false, state: "denied", msg: "Akses kamera ditolak" };
                default:        return { status: false, state: "unsupport", msg: "Permissions API tidak didukung" };
            }
        } catch (err) {
            console.error('Error cek izin kamera:', err);
            return { status: false, state: "error", msg: "Gagal cek izin kamera: " + err };
        }
    }
    async permissions() {
        const camStatus     = await this.cekKameraTersedia();
        const izinStatus    = await this.cekIzinKamera();

        const scanHeader    = document.querySelector('#scan h4');
        const scanText      = document.querySelector('.scan-notif-text');
        const toggleBtn     = document.querySelector('#toggle-btn');
        const switchCams    = document.querySelector('#switch-camera');
        const codeInput     = document.querySelector('#code-input-btn');

        const showErrorUI   = (icon, title, message, status = false) => {
            scanHeader.innerHTML = `${icon} ${title}`;
            scanText.innerHTML = message;

            if (status) {
                scanText.classList.add("dis-none");
                scanHeader.classList.remove("red");
                toggleBtn.classList.remove("off");
                switchCams.classList.remove("off");
            } else {
                scanText.classList.remove("dis-none");
                scanHeader.classList.add("red");
                toggleBtn.classList.add("off");
                switchCams.classList.add("off");
            }
            codeInput.classList.remove("off");
        };

        if (!camStatus.status) {
            return showErrorUI('<i class="fas fa-camera-slash"></i>', camStatus.msg, 'Gunakan perangkat dengan kamera atau input manual.');
        }

        if (!izinStatus.status) {
            return showErrorUI('<i class="fas fa-lock"></i>', 'Akses kamera ditolak', 'Ubah izin di pengaturan browser atau gunakan input manual.');
        }

        scanHeader.innerHTML = "QRCode Scanner";
        scanHeader.classList.remove("red");
        scanText.classList.add("dis-none");
        toggleBtn.classList.remove("off");
        switchCams.classList.remove("off");
        codeInput.classList.remove("off");

        return true;
    }
    async cekKameraTersedia() {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const kameraAda = devices.some(device => device.kind === 'videoinput');
            return kameraAda
                ? { status: true, state: 'detected', msg: 'Kamera terdeteksi.' }
                : { status: false, state: 'not detected', msg: 'Tidak ada kamera terdeteksi di perangkat ini' };
        } catch (err) {
            console.error('[QRScanner] Gagal deteksi kamera:', err);
            return { status: false, state: "error", msg: 'Gagal mendeteksi kamera: ' + err.message };
        }
    }
    async startScanner() {
        const toggleBtn = document.getElementById("toggle-btn");
        if (this.isScanning || this.isTransitioning || this.isStopping) {
            console.warn("[QRScanner] Tidak bisa start, sedang transisi atau scanning aktif");
            return;
        }
    
        if (this.cameras.length === 0) await this.initCameras();
        if (this.cameras.length === 0) {
            console.error("[QRScanner] Tidak ada kamera tersedia");
            return;
        }
    
        this.isTransitioning = true;
        this.isScanning = true;
        toggleBtn?.classList.add("active");
    
        const startWithConfig = async (config) => {
            try {
                await this.html5QrCode.start(
                    config,
                    { fps: 60, qrbox: { width: 300, height: 500 } },
                    async (decodedText, result) => {
                        this.drawOverlay(result);
                        document.getElementById("result").innerText = `Hasil: ${decodedText}`;
                        const checks = await this.encodeCheck(decodedText);
                        if (!checks.status) return;
                        await this.main.dataCtrl.run(checks.data);
                    }
                );
                console.log("[QRScanner] Scanner dimulai dengan config:", config);
                this.isTransitioning = false;
            } catch (err) {
                throw err;
            }
        };
    
        try {
            await startWithConfig({ deviceId: { exact: this.cameras[this.currentCamIndex].id } });
        } catch (err) {
            console.warn("[QRScanner] Gagal start deviceId:", err);
    
            try {
                await this.safeStop();
                this.html5QrCode = new Html5Qrcode("reader");
                await startWithConfig({ facingMode: "environment" });
            } catch (fallbackErr) {
                console.error("[QRScanner] Fallback gagal:", fallbackErr);
                this.isScanning = false;
                this.isTransitioning = false;
            }
        }
    }
    async stopScanner() {
        if (!this.isScanning || this.isTransitioning || this.isStopping) {
            console.log("[QRScanner] Skip stop, tidak dalam kondisi bisa distop.");
            return;
        }

        this.isStopping = true;
        this.isScanning = false;
        this.isTransitioning = true;

        document.getElementById("toggle-btn")?.classList.remove("active");

        try {
            await this.html5QrCode.stop({ clearScanRegion: true });
            await this.html5QrCode.clear();
            console.log("[QRScanner] Scanner berhenti.");
        } catch (err) {
            console.warn("[QRScanner] Gagal stop scanner:", err);
        }

        this.isStopping = false;
        this.isTransitioning = false;
    }
    async safeStop() {
        if (this.isScanning) {
            try {
                await this.stopScanner();
            } catch (e) {
                console.warn("[QRScanner] safeStop gagal:", e);
            }
        }
    }
    initGLFX() {
        if (typeof fx !== 'undefined') {
            this.fxCanvas = fx.canvas();
        } else {
            console.warn("WebGL FX library not found. Enhancer tidak aktif.");
        }
    }
    drawOverlay(result) {
        if (!this.overlayCanvas || !result?.location) return;
        const ctx = this.overlayCanvas.getContext("2d");
        const { topLeftCorner, bottomRightCorner } = result.location;
        const width = bottomRightCorner.x - topLeftCorner.x;
        const height = bottomRightCorner.y - topLeftCorner.y;
        const radius = 20;

        ctx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
        ctx.strokeStyle = "#00FF00";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(topLeftCorner.x + radius, topLeftCorner.y);
        ctx.lineTo(topLeftCorner.x + width - radius, topLeftCorner.y);
        ctx.quadraticCurveTo(topLeftCorner.x + width, topLeftCorner.y, topLeftCorner.x + width, topLeftCorner.y + radius);
        ctx.lineTo(topLeftCorner.x + width, topLeftCorner.y + height - radius);
        ctx.quadraticCurveTo(topLeftCorner.x + width, topLeftCorner.y + height, topLeftCorner.x + width - radius, topLeftCorner.y + height);
        ctx.lineTo(topLeftCorner.x + radius, topLeftCorner.y + height);
        ctx.quadraticCurveTo(topLeftCorner.x, topLeftCorner.y + height, topLeftCorner.x, topLeftCorner.y + height - radius);
        ctx.lineTo(topLeftCorner.x, topLeftCorner.y + radius);
        ctx.quadraticCurveTo(topLeftCorner.x, topLeftCorner.y, topLeftCorner.x + radius, topLeftCorner.y);
        ctx.closePath();
        ctx.stroke();
    }
    clearOverlay() {
        if (!this.overlayCanvas) return;
        const ctx = this.overlayCanvas.getContext("2d");
        ctx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
    }
    pauseAfterSuccess() {
        this.stopScanner();
        setTimeout(() => this.startScanner(), 3000);
    }
    bindEvents() {
        document.getElementById("toggle-btn")?.addEventListener("click", async () => {
            if (this.isBusy) return;
            if (this.isScanning) await this.stopScanner();
            else await this.startScanner();
        });
        document.getElementById("switch-camera")?.addEventListener("click", async () => {
            if (this.isSwitchingCamera || this.cameras.length < 2) return;
            
            const btn = document.getElementById("switch-camera");
            this.isSwitchingCamera = true;
            btn?.classList.add("off"); // disable tombol sementara
            
            this.currentCamIndex = (this.currentCamIndex + 1) % this.cameras.length;
    
            try {
                if (this.isScanning) {
                    await this.stopScanner(); // pastikan scanner dihentikan dengan aman
                    await this.startScanner(); // langsung nyalain lagi dengan kamera baru
                }
            } catch (e) {
                console.warn("[QRScanner] Error saat ganti kamera:", e);
            }
            btn?.classList.remove("off");
            this.isSwitchingCamera = false;
        });
        window.addEventListener("online",  () => console.log("[QRScanner] ONLINE"));
        window.addEventListener("offline", () => console.log("[QRScanner] OFFLINE"));
    }
}*/