document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const videoElement = document.getElementById('cameraStream');
    const captureCanvas = document.getElementById('captureCanvas');
    const captureBtn = document.getElementById('captureBtn');
    const switchCameraBtn = document.getElementById('switchCameraBtn');
    const resetBtn = document.getElementById('resetBtn');
    
    const loadingState = document.getElementById('loadingState');
    const errorState = document.getElementById('errorState');
    
    const cameraSection = document.querySelector('.camera-section');
    const resultsSection = document.getElementById('resultsSection');
    
    // Result Elements
    const colorSwatch = document.getElementById('colorSwatch');
    const colorHex = document.getElementById('colorHex');
    const colorRGB = document.getElementById('colorRGB');
    const toneResult = document.getElementById('toneResult');
    const undertoneResult = document.getElementById('undertoneResult');
    const recommendationText = document.getElementById('recommendationText');

    let currentStream = null;
    let usingFrontCamera = true;

    // Initialize Camera
    async function initCamera() {
        if (currentStream) {
            currentStream.getTracks().forEach(track => track.stop());
        }

        try {
            loadingState.classList.remove('hidden');
            errorState.classList.add('hidden');
            captureBtn.disabled = true;

            const constraints = {
                video: {
                    facingMode: usingFrontCamera ? 'user' : 'environment',
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            };

            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            currentStream = stream;
            videoElement.srcObject = stream;
            
            // Wait for video to be ready
            videoElement.onloadedmetadata = () => {
                videoElement.play();
                loadingState.classList.add('hidden');
                captureBtn.disabled = false;
            };

            // Check if multiple cameras exist to show switch button
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = devices.filter(device => device.kind === 'videoinput');
            if (videoDevices.length > 1) {
                switchCameraBtn.classList.remove('hidden');
            }

        } catch (err) {
            console.error('Error accessing camera:', err);
            loadingState.classList.add('hidden');
            errorState.classList.remove('hidden');
        }
    }

    // Capture and Analyze Frame
    function analyzeSkinTone() {
        const context = captureCanvas.getContext('2d', { willReadFrequently: true });
        
        // Set canvas dimensions to match video
        captureCanvas.width = videoElement.videoWidth;
        captureCanvas.height = videoElement.videoHeight;

        // Draw current video frame to canvas
        // If front camera, we need to flip the canvas context to match what the user sees
        if (usingFrontCamera) {
            context.translate(captureCanvas.width, 0);
            context.scale(-1, 1);
        }
        
        context.drawImage(videoElement, 0, 0, captureCanvas.width, captureCanvas.height);

        // Calculate center area (simulating the target overlay)
        // Target is 120x120 roughly in center. Let's sample a 60x60 square in the center.
        const sampleSize = 60;
        const startX = (captureCanvas.width / 2) - (sampleSize / 2);
        const startY = (captureCanvas.height / 2) - (sampleSize / 2);

        // Get pixel data from center
        const imageData = context.getImageData(startX, startY, sampleSize, sampleSize);
        const data = imageData.data;

        let r = 0, g = 0, b = 0;
        let count = 0;

        // Loop through pixels and calculate average
        for (let i = 0; i < data.length; i += 4) {
            // Basic filtering to ignore completely dark or overexposed pixels if any
            if (data[i] > 20 && data[i] < 250) {
                r += data[i];
                g += data[i + 1];
                b += data[i + 2];
                count++;
            }
        }

        if (count === 0) {
            // Fallback if filtering removed everything
            r = 0; g = 0; b = 0;
            count = 1;
        }

        r = Math.round(r / count);
        g = Math.round(g / count);
        b = Math.round(b / count);

        const hex = rgbToHex(r, g, b);
        displayResults(r, g, b, hex);
    }

    // Helper: RGB to Hex
    function rgbToHex(r, g, b) {
        return "#" + (1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1).toUpperCase();
    }

    // Classify Skin Tone
    function classifyTone(r, g, b) {
        // Luminance calculation
        const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        
        let tone = "Medium";
        if (luminance > 200) tone = "Very Fair / Porcelain";
        else if (luminance > 170) tone = "Fair / Light";
        else if (luminance > 130) tone = "Medium Light";
        else if (luminance > 90) tone = "Medium / Tan";
        else if (luminance > 50) tone = "Deep / Dark";
        else tone = "Very Deep";

        // Undertone calculation
        // Compare Red vs Blue/Green ratio
        let undertone = "Neutral";
        
        if (r > g && r > b) {
            const ratio = r / Math.max(b, 1);
            if (ratio > 1.8) {
                undertone = "Warm (Golden/Peach)";
            } else if (ratio < 1.4) {
                undertone = "Cool (Pink/Red)";
            } else {
                undertone = "Neutral (Olive/Balanced)";
            }
        }

        return { tone, undertone };
    }

    // Display Results
    function displayResults(r, g, b, hex) {
        const { tone, undertone } = classifyTone(r, g, b);

        // Update UI
        colorSwatch.style.backgroundColor = hex;
        colorHex.textContent = hex;
        colorRGB.textContent = `RGB(${r}, ${g}, ${b})`;
        toneResult.textContent = tone;
        undertoneResult.textContent = undertone;

        // Custom Recommendation
        if (tone.includes('Fair') || tone.includes('Light')) {
            recommendationText.textContent = "Your skin tone is on the lighter end of the spectrum. Sunscreen (SPF 30+) is highly recommended to protect against UV damage.";
        } else if (tone.includes('Deep')) {
            recommendationText.textContent = "Your rich skin tone has natural protection, but sunscreen is still recommended for overall skin health and to prevent hyperpigmentation.";
        } else {
            recommendationText.textContent = "Your medium skin tone is versatile. Ensure consistent hydration and sun protection for a healthy glow.";
        }

        // Switch Views
        cameraSection.classList.add('hidden');
        resultsSection.classList.remove('hidden');
        
        // Stop camera to save battery
        if (currentStream) {
            currentStream.getTracks().forEach(track => track.stop());
        }
    }

    // Event Listeners
    captureBtn.addEventListener('click', () => {
        captureBtn.innerHTML = '<div class="spinner" style="width: 20px; height: 20px; border-width: 2px;"></div> Analyzing...';
        captureBtn.disabled = true;
        
        // Slight delay to allow UI to update and feel like it's processing
        setTimeout(() => {
            analyzeSkinTone();
            // Reset button state for next time
            captureBtn.innerHTML = `
                <span class="btn-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="3"></circle></svg>
                </span>
                Analyze Skin Tone
            `;
        }, 800);
    });

    switchCameraBtn.addEventListener('click', () => {
        usingFrontCamera = !usingFrontCamera;
        // Flip video mirroring based on camera
        videoElement.style.transform = usingFrontCamera ? 'scaleX(-1)' : 'none';
        initCamera();
    });

    resetBtn.addEventListener('click', () => {
        resultsSection.classList.add('hidden');
        cameraSection.classList.remove('hidden');
        initCamera();
    });

    // Start App
    initCamera();
});
