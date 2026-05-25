import Capacitor

@objc(OyiBridgeViewController)
class OyiBridgeViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        super.capacitorDidLoad()
        bridge?.registerPluginInstance(OyiWatchSyncPlugin())
    }
}
