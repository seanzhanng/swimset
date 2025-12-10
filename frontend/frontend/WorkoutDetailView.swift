import SwiftUI

struct WorkoutDetailView: View {
    let workoutId: String

    @State private var workout: WorkoutRecordDTO?
    @State private var interpreted: InterpretedWorkoutDTO?

    @State private var isLoading: Bool = false
    @State private var errorMessage: String?

    // Editing state
    @State private var isEditing: Bool = false
    @State private var editableTitle: String = ""
    @State private var editableShorthand: String = ""
    @State private var isSavingChanges: Bool = false
    @State private var saveMessage: String?

    // PDF export state
    @State private var isDownloadingPDF: Bool = false
    @State private var pdfURL: URL?
    @State private var isPresentingShareSheet: Bool = false
    @State private var lastPDFViewMode: String = "coach"

    var body: some View {
        VStack {
            if isLoading && workout == nil {
                Spacer()
                ProgressView("Loading workout…")
                Spacer()
            } else if let errorMessage, workout == nil {
                Spacer()
                Text(errorMessage)
                    .foregroundColor(.red)
                    .multilineTextAlignment(.center)
                    .padding()
                Spacer()
            } else {
                contentView
            }
        }
        .navigationTitle(workout?.title ?? "Workout")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                if workout != nil {
                    Button(isEditing ? "Done" : "Edit") {
                        toggleEditing()
                    }
                }
            }
        }
        .task {
            await loadWorkout()
        }
        .sheet(isPresented: $isPresentingShareSheet) {
            if let pdfURL {
                ActivityView(activityItems: [pdfURL])
            }
        }
    }

    @ViewBuilder
    private var contentView: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                if isEditing {
                    editingSection
                } else {
                    if let workout {
                        headerView(for: workout)
                    }
                    if let interpreted {
                        WorkoutResultsView(interpreted: interpreted)
                            .frame(minHeight: 300)
                    }
                }

                pdfButtonsSection
            }
            .padding()
        }
    }

    // MARK: - Editing UI

    private var editingSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Edit Workout")
                .font(.headline)

            TextField("Title", text: $editableTitle)
                .textFieldStyle(.roundedBorder)

            Text("Shorthand")
                .font(.subheadline)

            TextEditor(text: $editableShorthand)
                .font(.system(.body, design: .monospaced))
                .frame(minHeight: 200)
                .padding(8)
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(Color.gray.opacity(0.3), lineWidth: 1)
                )

            HStack {
                Button(action: saveChangesTapped) {
                    if isSavingChanges {
                        ProgressView()
                            .progressViewStyle(.circular)
                        Text("Saving…")
                    } else {
                        Text("Save Changes")
                            .fontWeight(.semibold)
                    }
                }
                .buttonStyle(.borderedProminent)
                .disabled(isSavingChanges)

                if let saveMessage {
                    Text(saveMessage)
                        .font(.footnote)
                        .foregroundColor(.secondary)
                }
            }

            if let errorMessage {
                Text(errorMessage)
                    .font(.footnote)
                    .foregroundColor(.red)
            }
        }
    }

    private func headerView(for workout: WorkoutRecordDTO) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            if let distance = workout.totalDistanceMeters {
                Text("Total distance: \(distance) m")
            }
            if let pool = workout.poolLengthMeters {
                Text("Pool: \(pool) m")
            }
            if let focus = workout.focus {
                Text("Focus: \(focus)")
            }
            if let profile = workout.profile {
                Text("Profile: \(profile)")
            }
            if let saveMessage {
                Text(saveMessage)
                    .font(.footnote)
                    .foregroundColor(.secondary)
            }
            if let errorMessage {
                Text(errorMessage)
                    .font(.footnote)
                    .foregroundColor(.red)
            }
        }
        .font(.subheadline)
        .foregroundColor(.secondary)
    }

    @ViewBuilder
    private var pdfButtonsSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Export")
                .font(.headline)

            HStack {
                Button(action: { exportPDF(view: "coach") }) {
                    if isDownloadingPDF && lastPDFViewMode == "coach" {
                        ProgressView()
                            .progressViewStyle(.circular)
                        Text("Preparing Coach PDF…")
                    } else {
                        Text("Coach PDF")
                    }
                }
                .buttonStyle(.bordered)

                Button(action: { exportPDF(view: "swimmer") }) {
                    if isDownloadingPDF && lastPDFViewMode == "swimmer" {
                        ProgressView()
                            .progressViewStyle(.circular)
                        Text("Preparing Swimmer PDF…")
                    } else {
                        Text("Swimmer PDF")
                    }
                }
                .buttonStyle(.bordered)
            }
        }
    }

    // MARK: - Data loading

    private func loadWorkout() async {
        await MainActor.run {
            isLoading = true
            errorMessage = nil
            saveMessage = nil
        }

        do {
            let result = try await APIClient.shared.getWorkout(id: workoutId)
            await MainActor.run {
                self.workout = result.workout
                self.interpreted = result.interpreted
                self.editableTitle = result.workout.title ?? ""
                self.editableShorthand = result.workout.shorthand
                self.isLoading = false
            }
        } catch let apiError as APIError {
            await MainActor.run {
                self.errorMessage = mapAPIError(apiError)
                self.isLoading = false
            }
        } catch {
            await MainActor.run {
                self.errorMessage = "Unexpected error loading workout."
                self.isLoading = false
            }
        }
    }

    // MARK: - Editing actions

    private func toggleEditing() {
        if isEditing {
            // Leaving edit mode – clear transient errors
            errorMessage = nil
        } else if let workout {
            // Entering edit mode – ensure fields are populated
            editableTitle = workout.title ?? ""
            editableShorthand = workout.shorthand
            errorMessage = nil
            saveMessage = nil
        }
        isEditing.toggle()
    }

    private func saveChangesTapped() {
        Task {
            await saveChangesAsync()
        }
    }

    private func saveChangesAsync() async {
        guard let currentWorkout = workout else { return }

        await MainActor.run {
            isSavingChanges = true
            errorMessage = nil
            saveMessage = nil
        }

        let titleValue = editableTitle.trimmingCharacters(in: .whitespacesAndNewlines)
        let titleOrNil = titleValue.isEmpty ? nil : titleValue

        // Use interpreted header if available, otherwise fall back to stored fields
        let poolLength = interpreted?.header.poolLengthMeters ?? currentWorkout.poolLengthMeters
        let plannedDuration = interpreted?.header.plannedDurationMinutes ?? currentWorkout.plannedDurationMinutes
        let focus = interpreted?.header.focus ?? currentWorkout.focus
        let profile = interpreted?.header.profile ?? currentWorkout.profile

        let request = UpdateWorkoutRequestDTO(
            title: titleOrNil,
            shorthand: editableShorthand,
            poolLengthMeters: poolLength,
            plannedDurationMinutes: plannedDuration,
            focus: focus,
            profile: profile
        )

        do {
            let response = try await APIClient.shared.updateWorkout(id: currentWorkout.id, requestDTO: request)
            await MainActor.run {
                self.workout = response.workout
                self.interpreted = response.interpreted
                self.isSavingChanges = false
                self.saveMessage = "Changes saved."
                self.isEditing = false
            }
        } catch let apiError as APIError {
            await MainActor.run {
                self.isSavingChanges = false
                self.errorMessage = "Save failed: \(mapAPIError(apiError))"
            }
        } catch {
            await MainActor.run {
                self.isSavingChanges = false
                self.errorMessage = "Save failed due to an unexpected error."
            }
        }
    }

    // MARK: - PDF export

    private func exportPDF(view: String) {
        Task {
            await exportPDFAsync(view: view)
        }
    }

    private func exportPDFAsync(view: String) async {
        await MainActor.run {
            isDownloadingPDF = true
            lastPDFViewMode = view
            // Do not clear edit/save messages when exporting
        }

        do {
            let data = try await APIClient.shared.downloadWorkoutPDF(id: workoutId, view: view)

            let filename = "workout-\(workoutId.prefix(8))-\(view).pdf"
            let url = FileManager.default.temporaryDirectory.appendingPathComponent(filename)

            try data.write(to: url, options: .atomic)

            await MainActor.run {
                self.pdfURL = url
                self.isDownloadingPDF = false
                self.isPresentingShareSheet = true
            }
        } catch let apiError as APIError {
            await MainActor.run {
                self.isDownloadingPDF = false
                self.errorMessage = "PDF error: \(mapAPIError(apiError))"
            }
        } catch {
            await MainActor.run {
                self.isDownloadingPDF = false
                self.errorMessage = "Failed to generate PDF."
            }
        }
    }

    // MARK: - Error mapping

    private func mapAPIError(_ error: APIError) -> String {
        switch error {
        case .invalidURL:
            return "Invalid backend URL."
        case .badStatusCode(let code):
            return "Server error \(code)."
        case .decodingFailed:
            return "Decode error."
        case .encodingFailed:
            return "Encode error."
        case .noData:
            return "No data from server."
        }
    }
}

#Preview {
    NavigationView {
        WorkoutDetailView(workoutId: "example-id")
    }
}
