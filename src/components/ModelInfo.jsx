

function ModelInfo() {
  return (
    <div className="model-info">
      <div className="model-header">
        <h2>AutoEncoder Model Architecture</h2>
        <p className="model-subtitle">
          Deep convolutional autoencoder with symmetric embedding-retrieval mechanism
        </p>
      </div>

      <div className="model-grid">
        <div className="model-card">
          <div className="model-card-header">
            <span className="model-icon">🏗️</span>
            <h3>Encoder Architecture</h3>
          </div>
          <div className="model-card-content">
            <ul>
              <li><strong>Input Layer:</strong> 512×512×1 (Grayscale DICOM)</li>
              <li><strong>Conv Layers:</strong> 64→128→256→512 filters</li>
              <li><strong>Kernel Size:</strong> 3×3 with stride 2</li>
              <li><strong>Activation:</strong> LeakyReLU (α=0.2)</li>
              <li><strong>Latent Space:</strong> 128-bit compressed representation</li>
            </ul>
          </div>
        </div>

        <div className="model-card">
          <div className="model-card-header">
            <span className="model-icon">🔍</span>
            <h3>Decoder Architecture</h3>
          </div>
          <div className="model-card-content">
            <ul>
              <li><strong>Transposed Conv:</strong> 512→256→128→64 filters</li>
              <li><strong>Upsampling:</strong> Bilinear interpolation</li>
              <li><strong>Skip Connections:</strong> U-Net style</li>
              <li><strong>Output Activation:</strong> Tanh for [-1, 1] range</li>
              <li><strong>Loss Function:</strong> MSE + Perceptual Loss</li>
            </ul>
          </div>
        </div>

        <div className="model-card wide">
          <div className="model-card-header">
            <span className="model-icon">🔐</span>
            <h3>Watermark Embedding Module</h3>
          </div>
          <div className="model-card-content">
            <div className="embedding-process">
              <div className="process-step">
                <div className="step-number">1</div>
                <div className="step-content">
                  <h4>Feature Extraction</h4>
                  <p>Extract semantic features from encoder output using residual blocks</p>
                </div>
              </div>
              <div className="process-step">
                <div className="step-number">2</div>
                <div className="step-content">
                  <h4>Watermark Fusion</h4>
                  <p>128-bit tag + PHR metadata embedded via chaos-based distribution</p>
                </div>
              </div>
              <div className="process-step">
                <div className="step-number">3</div>
                <div className="step-content">
                  <h4>Reversible Encoding</h4>
                  <p>Pixel-exact restoration guaranteed through residual learning</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="model-card">
          <div className="model-card-header">
            <span className="model-icon">📈</span>
            <h3>Training Parameters</h3>
          </div>
          <div className="model-card-content">
            <div className="params-grid">
              <div className="param-item">
                <span className="param-label">Batch Size</span>
                <span className="param-value">16</span>
              </div>
              <div className="param-item">
                <span className="param-label">Learning Rate</span>
                <span className="param-value">0.0001</span>
              </div>
              <div className="param-item">
                <span className="param-label">Epochs</span>
                <span className="param-value">100</span>
              </div>
              <div className="param-item">
                <span className="param-label">Optimizer</span>
                <span className="param-value">Adam</span>
              </div>
            </div>
          </div>
        </div>

        <div className="model-card">
          <div className="model-card-header">
            <span className="model-icon">🎯</span>
            <h3>Performance Metrics</h3>
          </div>
          <div className="model-card-content">
            <div className="metrics">
              <div className="metric">
                <span className="metric-label">PSNR</span>
                <span className="metric-value">45.2 dB</span>
              </div>
              <div className="metric">
                <span className="metric-label">SSIM</span>
                <span className="metric-value">0.992</span>
              </div>
              <div className="metric">
                <span className="metric-label">Embedding Rate</span>
                <span className="metric-value">0.5 bpp</span>
              </div>
              <div className="metric">
                <span className="metric-label">NC</span>
                <span className="metric-value">0.999</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="model-schema">
        <h3>System Architecture Diagram</h3>
        <div className="schema-container">
          <div className="schema-row">
            <div className="schema-box primary">Input DICOM Image</div>
            <div className="schema-arrow">→</div>
            <div className="schema-box encoder">Encoder</div>
            <div className="schema-arrow">→</div>
            <div className="schema-box latent">Latent Space (128-bit)</div>
            <div className="schema-arrow">→</div>
            <div className="schema-box watermark">Watermark Embedding</div>
          </div>
          <div className="schema-row reverse">
            <div className="schema-box watermark">Watermark Extraction</div>
            <div className="schema-arrow">←</div>
            <div className="schema-box decoder">Decoder</div>
            <div className="schema-arrow">←</div>
            <div className="schema-box output">Output + Metadata</div>
            <div className="schema-arrow">←</div>
            <div className="schema-box primary">Original Restoration</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ModelInfo;