import SwiftUI

struct WorkoutsListView: View {

    @State private var workouts: [WorkoutRecordDTO] = []
    @State private var isLoading: Bool = false
    @State private var errorMessage: String?

    private static let dateFormatter: DateFormatter = {
        let df = DateFormatter()
        df.dateStyle = .medium
        df.timeStyle = .short
        return df;
    }()

    var body: some View {
        NavigationView {
            List {
                if isLoading {
                    HStack {
                        Spacer()
                        ProgressView("Loading workouts…")
                        Spacer()
                    }
                }

                if let errorMessage {
                    Text(errorMessage)
                        .foregroundColor(.red)
                        .font(.footnote)
                }

                ForEach(workouts) { workout in
                    NavigationLink(destination: WorkoutDetailView(workoutId: workout.id)) {
                        WorkoutRow(workout: workout)
                    }
                }
                .onDelete(perform: deleteWorkouts)

                if !isLoading && workouts.isEmpty && errorMessage == nil {
                    Text("No workouts saved yet.")
                        .foregroundColor(.secondary)
                }
            }
            .navigationTitle("Workouts")
            .task {
                await loadWorkouts()
            }
            .refreshable {
                await loadWorkouts()
            }
        }
    }

    private func loadWorkouts() async {
        await MainActor.run {
            isLoading = true
            errorMessage = nil
        }

        do {
            let result = try await APIClient.shared.listWorkouts()
            let sorted = result.sorted(by: { $0.createdAt > $1.createdAt })
            await MainActor.run {
                self.workouts = sorted
                self.isLoading = false
            }
        } catch let apiError as APIError {
            await MainActor.run {
                self.errorMessage = mapAPIError(apiError)
                self.isLoading = false
            }
        } catch {
            await MainActor.run {
                self.errorMessage = "Unexpected error loading workouts."
                self.isLoading = false
            }
        }
    }

    private func deleteWorkouts(at offsets: IndexSet) {
        let ids = offsets.map { workouts[$0].id }

        Task {
            do {
                for id in ids {
                    try await APIClient.shared.deleteWorkout(id: id)
                }
                await MainActor.run {
                    workouts.remove(atOffsets: offsets)
                }
            } catch let apiError as APIError {
                await MainActor.run {
                    self.errorMessage = "Delete failed: \(mapAPIError(apiError))"
                }
            } catch {
                await MainActor.run {
                    self.errorMessage = "Delete failed due to an unexpected error."
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

    private struct WorkoutRow: View {
        let workout: WorkoutRecordDTO

        var body: some View {
            VStack(alignment: .leading, spacing: 4) {
                Text(workout.title ?? "Untitled workout")
                    .font(.headline)

                HStack(spacing: 12) {
                    if let distance = workout.totalDistanceMeters {
                        Text("\(distance) m")
                    }
                    if let focus = workout.focus {
                        Text(focus)
                            .textCase(.lowercase)
                    }
                    if let profile = workout.profile {
                        Text(profile)
                            .textCase(.lowercase)
                    }
                }
                .font(.subheadline)
                .foregroundColor(.secondary)

                Text(WorkoutsListView.dateFormatter.string(from: workout.createdAt))
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
    }
}

#Preview {
    WorkoutsListView()
}
