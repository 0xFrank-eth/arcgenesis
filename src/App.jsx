import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { WagmiProvider } from './providers/WagmiProvider';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { HomePage } from './pages/HomePage';
import { QuickMint } from './pages/QuickMint';
import { Gallery } from './pages/Gallery';

function App() {
    return (
        <WagmiProvider>
            <BrowserRouter>
                <div className="app">
                    <Header />
                    <main className="main">
                        <Routes>
                            <Route path="/" element={<HomePage />} />
                            <Route path="/quick-mint" element={<QuickMint />} />
                            <Route path="/gallery" element={<Gallery />} />
                        </Routes>
                    </main>
                    <Footer />
                </div>
            </BrowserRouter>
        </WagmiProvider>
    );
}

export default App;
