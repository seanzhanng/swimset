import SwiftUI

@main
struct frontendApp: App {
    var body: some Scene {
        WindowGroup {
            TabView {
                ContentView()
                    .tabItem {
                        Image(systemName: "pencil")
                        Text("Write")
                    }

                GenerateWorkoutView()
                    .tabItem {
                        Image(systemName: "wand.and.stars")
                        Text("Generate")
                    }
            }
        }
    }
}
