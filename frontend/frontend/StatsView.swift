import SwiftUI

struct StatsView: View {

    @State private var summary: StatsSummaryDTO?
    @State private var isLoading: Bool = false
    @State private var errorMessage: String?

    var body: some View {
        NavigationView {
            Group {
                if isLoading && summary == nil {
                    VStack {
                        Spacer()
                        ProgressView("Loading stats…")
                        Spacer()
                    }
                } else if let errorMessage, summary == nil {
                    VStack {
                        Spacer()
                        Text(errorMessage)
                            .foregroundColor(.red)
                            .multilineTextAlignment(.center)
                            .padding()
                        Spacer()
                    }
                } else if let summary {
                    ScrollView {
                        VStack(alignment: .leading, spacing: 20) {
                            overallSection(summary: summary)
                            focusSection(summary: summary)
                            profileSection(summary: summary)
                        }
                        .padding()
                    }
                } else {
                    VStack {
                        Spacer()
                        Text("No stats yet.\nCreate and save some workouts.")
                            .multilineTextAlignment(.center)
                            .foregroundColor(.secondary)
                        Spacer()
                    }
                }
            }
            .navigationTitle("Stats")
            .task {
                await loadStats()
            }
            .refreshable {
                await loadStats()
            }
        }
    }

    private func loadStats() async {
        await MainActor.run {
            isLoading = true
            errorMessage = nil
        }

        do {
            let result = try await APIClient.shared.getStatsSummary()
            await MainActor.run {
                self.summary = result
                self.isLoading = false
            }
        } catch let apiError as APIError {
            await MainActor.run {
                self.errorMessage = mapAPIError(apiError)
                self.isLoading = false
            }
        } catch {
            await MainActor.run {
                self.errorMessage = "Unexpected error loading stats."
                self.isLoading = false
            }
        }
    }

    private func overallSection(summary: StatsSummaryDTO) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Overview")
                .font(.headline)

            HStack {
                VStack(alignment: .leading) {
                    Text("Total distance")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                    Text("\(summary.totalDistanceMeters) m")
                        .font(.title3)
                        .fontWeight(.semibold)
                }
                Spacer()
                VStack(alignment: .leading) {
                    Text("Workouts")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                    Text("\(summary.workoutCount)")
                        .font(.title3)
                        .fontWeight(.semibold)
                }
            }

            HStack {
                VStack(alignment: .leading) {
                    Text("Last 7 days")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                    Text("\(summary.distanceLast7Days) m")
                        .font(.body)
                }
                Spacer()
                VStack(alignment: .leading) {
                    Text("Last 30 days")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                    Text("\(summary.distanceLast30Days) m")
                        .font(.body)
                }
            }
        }
    }

    private func focusSection(summary: StatsSummaryDTO) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("By Focus")
                .font(.headline)

            if summary.distanceByFocus.isEmpty {
                Text("No focus data yet.")
                    .font(.footnote)
                    .foregroundColor(.secondary)
            } else {
                let items = summary.distanceByFocus.sorted { $0.value > $1.value }
                ForEach(items, id: \.key) { key, value in
                    HStack {
                        Text(key.isEmpty ? "Unknown" : key)
                        Spacer()
                        Text("\(value) m")
                            .foregroundColor(.secondary)
                    }
                    .font(.subheadline)
                }
            }
        }
    }

    private func profileSection(summary: StatsSummaryDTO) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("By Profile")
                .font(.headline)

            if summary.distanceByProfile.isEmpty {
                Text("No profile data yet.")
                    .font(.footnote)
                    .foregroundColor(.secondary)
            } else {
                let items = summary.distanceByProfile.sorted { $0.value > $1.value }
                ForEach(items, id: \.key) { key, value in
                    HStack {
                        Text(key.isEmpty ? "Unknown" : key)
                        Spacer()
                        Text("\(value) m")
                            .foregroundColor(.secondary)
                    }
                    .font(.subheadline)
                }
            }
        }
    }

    private func mapAPIError(_ error: APIError) -> String {
        switch error {
        case .invalidURL:
            return "Invalid backend URL."
        case .badStatusCode(let code):
            return "Server error \(code)."
        case .decodingFailed:
            return "Failed to decode server response."
        case .encodingFailed:
            return "Encoding error."
        case .noData:
            return "No data from server."
        }
    }
}

#Preview {
    StatsView()
}
