import torch
import torch.nn as nn
import torch.nn.functional as F

class Autoencoder(nn.Module):
    """Deep convolutional autoencoder for medical images"""
    
    def __init__(self, latent_dim=128):
        super(Autoencoder, self).__init__()
        self.latent_dim = latent_dim
        
        # Encoder
        self.encoder = nn.Sequential(
            # Input: 512x512x1
            nn.Conv2d(1, 64, kernel_size=3, stride=2, padding=1),  # 256x256
            nn.LeakyReLU(0.2, inplace=True),
            
            nn.Conv2d(64, 128, kernel_size=3, stride=2, padding=1),  # 128x128
            nn.LeakyReLU(0.2, inplace=True),
            
            nn.Conv2d(128, 256, kernel_size=3, stride=2, padding=1),  # 64x64
            nn.LeakyReLU(0.2, inplace=True),
            
            nn.Conv2d(256, 512, kernel_size=3, stride=2, padding=1),  # 32x32
            nn.LeakyReLU(0.2, inplace=True),
            
            nn.Conv2d(512, 512, kernel_size=3, stride=2, padding=1),  # 16x16
            nn.LeakyReLU(0.2, inplace=True),
        )
        
        # Latent space
        self.fc_encoder = nn.Linear(512 * 16 * 16, latent_dim)
        self.fc_decoder = nn.Linear(latent_dim, 512 * 16 * 16)
        
        # Decoder (with skip connections like U-Net)
        self.decoder = nn.Sequential(
            nn.ConvTranspose2d(512, 512, kernel_size=3, stride=2, padding=1, output_padding=1),  # 32x32
            nn.LeakyReLU(0.2, inplace=True),
            
            nn.ConvTranspose2d(512, 256, kernel_size=3, stride=2, padding=1, output_padding=1),  # 64x64
            nn.LeakyReLU(0.2, inplace=True),
            
            nn.ConvTranspose2d(256, 128, kernel_size=3, stride=2, padding=1, output_padding=1),  # 128x128
            nn.LeakyReLU(0.2, inplace=True),
            
            nn.ConvTranspose2d(128, 64, kernel_size=3, stride=2, padding=1, output_padding=1),  # 256x256
            nn.LeakyReLU(0.2, inplace=True),
            
            nn.ConvTranspose2d(64, 1, kernel_size=3, stride=2, padding=1, output_padding=1),  # 512x512
            nn.Tanh()
        )
        
    def forward(self, x):
        # Encode
        encoded = self.encoder(x)
        encoded_flat = encoded.view(encoded.size(0), -1)
        latent = self.fc_encoder(encoded_flat)
        
        # Decode
        decoded_flat = self.fc_decoder(latent)
        decoded = decoded_flat.view(decoded_flat.size(0), 512, 16, 16)
        reconstructed = self.decoder(decoded)
        
        return reconstructed, latent
    
    def encode(self, x):
        encoded = self.encoder(x)
        encoded_flat = encoded.view(encoded.size(0), -1)
        return self.fc_encoder(encoded_flat)
    
    def decode(self, latent):
        decoded_flat = self.fc_decoder(latent)
        decoded = decoded_flat.view(decoded_flat.size(0), 512, 16, 16)
        return self.decoder(decoded)


class WatermarkEmbeddingModule(nn.Module):
    """Module for embedding watermarks in latent space"""
    
    def __init__(self, latent_dim=128, watermark_dim=64):
        super(WatermarkEmbeddingModule, self).__init__()
        
        self.fusion = nn.Sequential(
            nn.Linear(latent_dim + watermark_dim, latent_dim),
            nn.ReLU(),
            nn.Linear(latent_dim, latent_dim)
        )
        
    def forward(self, latent, watermark):
        combined = torch.cat([latent, watermark], dim=1)
        return self.fusion(combined)


def get_autoencoder(weights_path=None, device='cpu'):
    """Load autoencoder model"""
    model = Autoencoder(latent_dim=128)
    
    if weights_path:
        model.load_state_dict(torch.load(weights_path, map_location=device))
    
    model = model.to(device)
    model.eval()
    
    return model