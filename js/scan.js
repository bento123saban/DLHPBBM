
    let html5QrCode = new Html5Qrcode("reader");
    let cameras = [];
    let currentCamIndex = 0;
    let isScanning = false;

    async function initCameras() {
      cameras = await Html5Qrcode.getCameras();
      if (cameras.length === 0) {
        alert("Tidak ada kamera ditemukan");
        return;
      }
    }

    async function startScanner() {
      if (cameras.length === 0) {
        alert("Tidak ada kamera ditemukan");
        return;
      }
      isScanning = true;
      document.getElementById("toggle-btn").classList.add("active");

      await html5QrCode.start(
        { deviceId: { exact: cameras[currentCamIndex].id } },
        { fps: 60, qrbox: {
          width : 350,
          height : 500
        } },
        (decodedText) => {
          document.getElementById("result").innerText = `Hasil: ${decodedText}`;
        },
        (error) => {
          console.log(error);
        }
      );
    }

    async function stopScanner() {
      isScanning = false;
      document.getElementById("toggle-btn").classList.remove("active");

      await html5QrCode.stop();
      html5QrCode.clear();
    }

    document.getElementById("toggle-btn").addEventListener("click", async () => {
      if (isScanning) {
        await stopScanner();
      } else {
        await startScanner();
      }
    });

    document.getElementById("switch-camera").addEventListener("click", async () => {
      if (cameras.length < 2) return;
      currentCamIndex = (currentCamIndex + 1) % cameras.length;
      if (isScanning) {
        await stopScanner();
        await startScanner();
      }
    });

    document.getElementById("upload-btn").addEventListener("click", () => {
      document.getElementById("file-input").click();
    });

    document.getElementById("file-input").addEventListener("change", (e) => {
      if (e.target.files.length === 0) return alert('note-found');
      console.log('input image')
      html5QrCode.scanFile(e.target.files[0], true)
        .then(decodedText => {
          console.log(decodedText)
        })
        .catch(err => {
          alert("QR tidak ditemukan pada gambar");
        });
    });

    initCameras();
  