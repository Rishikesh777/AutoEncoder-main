

function MedicalApplication() {
  return (
    <div className="medical-application">
      <div className="medical-header">
        <h2>🏥 Medical Image Security Application</h2>
        <p className="medical-subtitle">
          Secure and reversible data hiding for DICOM images in healthcare systems
        </p>
      </div>

      <div className="application-overview">
        <div className="overview-card">
          <h3>Problem Statement</h3>
          <p>
            Medical imaging systems require <strong>pixel-exact restoration</strong> for diagnostic 
            reliability while needing to embed <strong>Patient Health Records (PHR)</strong>, 
            institutional metadata, and integrity signatures. Traditional methods compromise 
            either security or image quality.
          </p>
        </div>
        
        <div className="overview-card">
          <h3>Our Solution</h3>
          <p>
            A <strong>fragile reversible watermarking framework</strong> that guarantees exact 
            reconstruction while enabling explicit self-authentication of embedded integrity 
            data for 16-bit DICOM images.
          </p>
        </div>
      </div>

      <div className="workflow-section">
        <h3>Clinical Workflow Integration</h3>
        
        <div className="workflow-steps">
          <div className="workflow-step">
            <div className="step-icon">📷</div>
            <div className="step-content">
              <h4>1. Image Acquisition</h4>
              <p>16-bit DICOM images acquired from medical imaging devices (MRI, CT, X-Ray)</p>
            </div>
          </div>
          
          <div className="workflow-step">
            <div className="step-icon">🔐</div>
            <div className="step-content">
              <h4>2. Data Embedding</h4>
              <p>PHR metadata, signatures, and 128-bit autoencoder tag embedded using chaos-based distribution</p>
            </div>
          </div>
          
          <div className="workflow-step">
            <div className="step-icon">📤</div>
            <div className="step-content">
              <h4>3. Secure Transmission</h4>
              <p>Protected images transmitted through PACS networks or telemedicine systems</p>
            </div>
          </div>
          
          <div className="workflow-step">
            <div className="step-icon">✅</div>
            <div className="step-content">
              <h4>4. Integrity Verification</h4>
              <p>Automatic authentication and tamper detection at receiving end</p>
            </div>
          </div>
          
          <div className="workflow-step">
            <div className="step-icon">🔄</div>
            <div className="step-content">
              <h4>5. Exact Restoration</h4>
              <p>Original image restored pixel-exactly after data extraction</p>
            </div>
          </div>
        </div>
      </div>

      <div className="features-grid">
        <div className="feature-card">
          <div className="feature-icon">💯</div>
          <h4>100% Reversible</h4>
          <p>Guaranteed pixel-exact restoration of original medical images</p>
        </div>
        
        <div className="feature-card">
          <div className="feature-icon">🏥</div>
          <h4>DICOM Compatible</h4>
          <p>Full support for 16-bit DICOM format with header preservation</p>
        </div>
        
        <div className="feature-card">
          <div className="feature-icon">🔍</div>
          <h4>Self-Authentication</h4>
          <p>Built-in integrity verification of embedded authentication data</p>
        </div>
        
        <div className="feature-card">
          <div className="feature-icon">⚡</div>
          <h4>Lightweight</h4>
          <p>Minimal computational overhead for clinical workflow integration</p>
        </div>
        
        <div className="feature-card">
          <div className="feature-icon">📊</div>
          <h4>Compliance Ready</h4>
          <p>Meets HIPAA and medical imaging regulatory requirements</p>
        </div>
        
        <div className="feature-card">
          <div className="feature-icon">🛡️</div>
          <h4>Tamper Detection</h4>
          <p>Automatic detection of unauthorized modifications</p>
        </div>
      </div>

      <div className="use-cases">
        <h3>Clinical Use Cases</h3>
        
        <div className="use-case-cards">
          <div className="use-case-card">
            <h4>Telemedicine</h4>
            <ul>
              <li>Secure transmission of diagnostic images</li>
              <li>Patient identity verification</li>
              <li>Cross-institution image sharing</li>
            </ul>
          </div>
          
          <div className="use-case-card">
            <h4>PACS Integration</h4>
            <ul>
              <li>Secure archiving of medical images</li>
              <li>Audit trail and access control</li>
              <li>Long-term integrity preservation</li>
            </ul>
          </div>
          
          <div className="use-case-card">
            <h4>Research & Education</h4>
            <ul>
              <li>Anonymized dataset sharing</li>
              <li>Training data protection</li>
              <li>Multi-center study coordination</li>
            </ul>
          </div>
        </div>
      </div>

      <div className="technical-specs">
        <h3>Technical Specifications</h3>
        
        <div className="specs-grid">
          <div className="spec-item">
            <span className="spec-label">Image Format</span>
            <span className="spec-value">16-bit DICOM</span>
          </div>
          
          <div className="spec-item">
            <span className="spec-label">Embedding Capacity</span>
            <span className="spec-value">0.5 bits per pixel</span>
          </div>
          
          <div className="spec-item">
            <span className="spec-label">Authentication Tag</span>
            <span className="spec-value">128-bit autoencoder</span>
          </div>
          
          <div className="spec-item">
            <span className="spec-label">PSNR</span>
            <span className="spec-value">≥ 45 dB</span>
          </div>
          
          <div className="spec-item">
            <span className="spec-label">SSIM</span>
            <span className="spec-value">≥ 0.995</span>
          </div>
          
          <div className="spec-item">
            <span className="spec-label">Processing Time</span>
            <span className="spec-value">&lt; 500ms per image</span>
          </div>
        </div>
      </div>

      <div className="benefits-section">
        <h3>Clinical Benefits</h3>
        
        <div className="benefits-content">
          <div className="benefit">
            <h4>Enhanced Diagnostic Confidence</h4>
            <p>Pixel-exact restoration ensures no loss of diagnostic information</p>
          </div>
          
          <div className="benefit">
            <h4>Regulatory Compliance</h4>
            <p>Supports HIPAA, GDPR, and medical device regulations</p>
          </div>
          
          <div className="benefit">
            <h4>Workflow Efficiency</h4>
            <p>Seamless integration with existing medical imaging systems</p>
          </div>
          
          <div className="benefit">
            <h4>Cost Reduction</h4>
            <p>Eliminates need for separate secure storage and transmission systems</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MedicalApplication;